import { useCallback, useEffect, useRef, useState } from 'react';
import logoUrl from '../assets/schreiber-logo.png';
import {
  fullDate,
  onTheCrewPage,
  previousOnTheCrewPage,
  sentStamp,
  type DailySchedule,
  type Roster,
  type SentSchedule,
} from '../schedule-rules';
import { useOnFocus } from '../screen/useOnFocus';
import { HUB_HOME } from '../signIn/hubConfig';
import type { ScheduleStore } from '../storage';
import { reloadsOnFocus } from '../storage/reloadOnFocus';
import type { Saves } from '../storage/saveQueue';
import { CrewCards, useCrewColumns } from '../tv/CrewCards';

/** What the Crew Page last read from the store. */
interface Shown {
  roster: Roster;
  sent: SentSchedule | null;
  /** The Sent Daily Schedule before it, for "Previous"; null when there is none. */
  previous: SentSchedule | null;
}

/**
 * Reads what the Crew Page should show (see `onTheCrewPage`). The saved Daily
 * Schedules are read from the latest date back, only as far as the second one
 * that has been Sent (the one "Previous" shows). Nothing is saved or created.
 */
async function read(store: ScheduleStore): Promise<Shown> {
  const roster = (await store.loadRoster()) ?? { crewMembers: [], jobs: [] };
  const dates = [...(await store.listScheduleDates())].sort().reverse();
  const saved: DailySchedule[] = [];
  for (const date of dates) {
    const schedule = await store.loadSchedule(date);
    if (schedule) saved.push(schedule);
    if (previousOnTheCrewPage(roster, saved)) break;
  }
  return { roster, sent: onTheCrewPage(roster, saved), previous: previousOnTheCrewPage(roster, saved) };
}

/** Whether two reads say the same thing (they are plain data, as stored). */
const sameShown = (a: Shown, b: Shown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * The Crew Page: the newest Daily Schedule that has been Sent, exactly as the
 * crew got it, as the same cards as the crew picture and the Office TV: one
 * column that scrolls on a phone, the picture's columns on a wide screen.
 * Read-only. "Previous" steps back once, to the Sent Daily Schedule before
 * it, and "Latest" comes back; there is no further history. It reads again
 * whenever it comes back to the front, and goes back to the latest, so a
 * later Send shows.
 */
export function CrewPage({ store, saves }: { store: ScheduleStore; saves: Saves }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const [failed, setFailed] = useState(false);
  /** Whether "Previous" was tapped: the one before the newest is on the page. */
  const [steppedBack, setSteppedBack] = useState(false);
  /** Counts the reads begun, so only the latest one's result is shown. */
  const reads = useRef(0);

  const refresh = useCallback(() => {
    const thisRead = ++reads.current;
    read(store).then(
      (next) => {
        // A read begun later has already been (or will be) shown: this one is stale.
        if (thisRead !== reads.current) return;
        setFailed(false);
        // The same as what is shown: keep it, so nothing is drawn again.
        setShown((current) => (current !== null && sameShown(current, next) ? current : next));
      },
      (error) => {
        console.error('Could not read the Daily Schedule', error);
        if (thisRead === reads.current) setFailed(true);
      },
    );
  }, [store]);

  useEffect(refresh, [refresh]);
  // Reload on focus, by the same rule as the board. This page never saves, so
  // there is never a change waiting.
  useOnFocus(() => {
    setSteppedBack(false);
    if (reloadsOnFocus(saves.state())) refresh();
  });

  const previous = shown?.previous ?? null;
  // Stepped back with nothing before the newest (a read took it away): the latest.
  const sent = (steppedBack && previous) || (shown?.sent ?? null);
  return (
    <div className="crew-page">
      <header className="crew-head">
        <img className="crew-logo" src={logoUrl} alt="Schreiber Excavating" />
        <div className="crew-title">
          {sent && <h1 className="crew-date">{fullDate(sent.view.date)}</h1>}
          {sent && <p className="crew-sent">{sentLine(sent)}</p>}
        </div>
        {previous && (
          <button className="crew-step" type="button" onClick={() => setSteppedBack(sent !== previous)}>
            {sent === previous ? 'Latest' : 'Previous'}
          </button>
        )}
        <a className="crew-hub" href={HUB_HOME}>
          Back to the Hub
        </a>
      </header>
      {shown && sent && <Cards roster={shown.roster} sent={sent} />}
      {shown && !sent && <p className="crew-message">No Daily Schedule has been Sent yet.</p>}
      {!shown && failed && (
        <p className="crew-message">Could not load the Daily Schedule. Check your connection and open the page again.</p>
      )}
    </div>
  );
}

/** "Sent Wed, Nov 11 · 6:42 PM", or "Sent again Wed, Nov 11 · 7:10 PM" when it replaced an earlier one. */
function sentLine({ sentAt, sentAgain }: SentSchedule): string {
  const stamp = sentStamp(new Date(sentAt));
  return sentAgain ? stamp.replace(/^Sent/, 'Sent again') : stamp;
}

function Cards({ roster, sent }: { roster: Roster; sent: SentSchedule }) {
  const columns = useCrewColumns(sent.view, roster);
  return <CrewCards roster={roster} view={sent.view} columns={columns} />;
}
