import { useCallback, useEffect, useRef, useState } from 'react';
import logoUrl from '../assets/schreiber-logo.png';
import {
  fullDate,
  sameData,
  sentStamp,
  type CrewPageShown,
  type Roster,
  type SentSchedule,
} from '../schedule-rules';
import { useOnFocus } from '../screen/useOnFocus';
import { HUB_HOME } from '../signIn/hubConfig';
import { API_BASE, apiRequest, browserFetch, type Fetch } from '../storage/apiStore';
import { CrewCards, useCrewColumns } from '../tv/CrewCards';

/**
 * Asks the server what the Crew Page shows (the API's /crew-page): one
 * request, answered with only what has been Sent. The server works it out
 * (`crewPageShown`), so a Daily Schedule that has not been Sent never reaches
 * this page. Rejects (an ApiError) if the server could not say.
 */
export async function loadCrewPage(fetchFn: Fetch = browserFetch, base: string = API_BASE): Promise<CrewPageShown> {
  const answer = (await (await apiRequest(fetchFn, `${base}/crew-page`)).json()) as Partial<CrewPageShown> | null;
  return {
    jobs: Array.isArray(answer?.jobs) ? answer.jobs : [],
    sent: answer?.sent ?? null,
    previous: answer?.previous ?? null,
  };
}

/** What the Crew Page last read, and its Jobs as the Roster the cards are drawn with. */
interface Shown extends CrewPageShown {
  roster: Roster;
}

/**
 * The Crew Page: the newest Daily Schedule that has been Sent, exactly as the
 * crew got it, as the same cards as the crew picture and the Office TV: one
 * column that scrolls on a phone, the picture's columns on a wide screen.
 * Read-only. "Previous" steps back once, to the Sent Daily Schedule before
 * it, and "Latest" comes back; there is no further history. It reads again
 * whenever it comes back to the front, and goes back to the latest, so a
 * later Send shows.
 */
export function CrewPage({ fetchFn }: { fetchFn?: Fetch }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const [failed, setFailed] = useState(false);
  /** Whether "Previous" was tapped: the one before the newest is on the page. */
  const [steppedBack, setSteppedBack] = useState(false);
  /** Counts the reads begun, so only the latest one's result is shown. */
  const reads = useRef(0);

  const refresh = useCallback(() => {
    const thisRead = ++reads.current;
    loadCrewPage(fetchFn).then(
      (next) => {
        // A read begun later has already been (or will be) shown: this one is stale.
        if (thisRead !== reads.current) return;
        setFailed(false);
        // The same as what is shown: keep it, so nothing is drawn again.
        setShown((current) =>
          current !== null && sameData({ ...current, roster: undefined }, next)
            ? current
            : { ...next, roster: { crewMembers: [], jobs: next.jobs } },
        );
      },
      (error) => {
        console.error('Could not read the Daily Schedule', error);
        if (thisRead === reads.current) setFailed(true);
      },
    );
  }, [fetchFn]);

  useEffect(refresh, [refresh]);
  // It reads again whenever it comes back to the front. This page never
  // saves, so there is never a change waiting.
  useOnFocus(() => {
    setSteppedBack(false);
    refresh();
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
