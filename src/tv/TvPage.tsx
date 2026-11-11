import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import logoUrl from '../assets/schreiber-logo.png';
import {
  cardTitle,
  fullDate,
  onTheTv,
  scheduleDateOf,
  type CrewView,
  type Roster,
  type ScheduleRow,
} from '../schedule-rules';
import type { ScheduleStore } from '../storage';

/** How often the TV looks again, besides whenever the Scheduler's screen saves. */
const LOOK_AGAIN_MS = 60_000;

/** What the TV last read from the store. */
interface Shown {
  roster: Roster;
  view: CrewView | null;
  today: string;
}

/** Reads what the TV should show: today's Daily Schedule (see `onTheTv`). */
async function read(store: ScheduleStore): Promise<Shown> {
  const today = scheduleDateOf(new Date());
  const roster = (await store.loadRoster()) ?? { crewMembers: [], jobs: [] };
  const dates = (await store.listScheduleDates()).filter((date) => date >= today);
  const saved = (await Promise.all(dates.map((date) => store.loadSchedule(date)))).filter(
    (schedule) => schedule !== null,
  );
  return { roster, view: onTheTv(roster, saved, today), today };
}

/**
 * Today's Daily Schedule, made to be read from across the office: the same
 * cards the crew is sent, side by side in columns across a wide screen,
 * sized to fill it with nothing to scroll. It changes by itself when the
 * Scheduler Sends or changes today's, and at midnight. Nothing on it is pressed, except that a
 * click anywhere puts it full screen (or back).
 */
export function TvPage({ store }: { store: ScheduleStore }) {
  const [shown, setShown] = useState<Shown | null>(null);

  const refresh = useCallback(() => {
    read(store).then(setShown, (error) => console.error('Could not read the Daily Schedule', error));
  }, [store]);

  useEffect(() => {
    refresh();
    // A save on the Scheduler's screen in another tab or window of this browser.
    window.addEventListener('storage', refresh);
    const timer = window.setInterval(refresh, LOOK_AGAIN_MS);
    return () => {
      window.removeEventListener('storage', refresh);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const toggleFullScreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="tv" onClick={toggleFullScreen}>
      {shown && (shown.view ? <Board roster={shown.roster} view={shown.view} /> : <NothingYet today={shown.today} />)}
    </div>
  );
}

function NothingYet({ today }: { today: string }) {
  return (
    <div className="tv-empty">
      <img className="tv-logo" src={logoUrl} alt="Schreiber Excavating" />
      <p className="tv-empty-date">{fullDate(today)}</p>
      <p className="tv-empty-text">Today's schedule shows here as soon as it is made.</p>
    </div>
  );
}

function Board({ roster, view }: { roster: Roster; view: CrewView }) {
  const fitRef = useFit([view]);

  return (
    <div className="tv-fit" ref={fitRef}>
      <header className="tv-head">
        <img className="tv-logo" src={logoUrl} alt="Schreiber Excavating" />
        <h1 className="tv-date">{fullDate(view.date)}</h1>
      </header>
      <main className="tv-cards">
        {view.rows.map((row) => (
          <Card key={row.key} roster={roster} row={row} />
        ))}
        {view.dayNotes && view.dayNotes.length > 0 && (
          <section className="tv-card tv-day-notes">
            <h2 className="tv-card-name tv-card-name-yard">Notes for the day</h2>
            {view.dayNotes.map((note, index) => (
              <p key={index} className="tv-day-note">
                {note}
              </p>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

function Card({ roster, row }: { roster: Roster; row: ScheduleRow }) {
  const isJob = row.destination.kind === 'job';
  const { name, number } = cardTitle(roster, row);
  return (
    <section className="tv-card">
      <div className="tv-card-head">
        <h2 className={`tv-card-name${isJob ? '' : ' tv-card-name-yard'}`}>
          {name}
          {number && <span className="tv-card-number">{number}</span>}
        </h2>
        <span className="tv-card-count">{row.who.length}</span>
      </div>
      {row.tasks.length > 0 && (
        <ul className="tv-tasks">
          {row.tasks.map((task, index) => (
            <li key={index}>{task}</li>
          ))}
        </ul>
      )}
      <ul className="tv-names">
        {row.who.map(({ crewMember, note, personTasks = [] }) => (
          <li key={crewMember.id} className={`tv-name${crewMember.foreman ? ' tv-name-foreman' : ''}`}>
            <div className="tv-name-head">
              <span className="tv-dot" style={{ background: `var(--dot-${crewMember.color})` }} />
              <span className="tv-name-text">{crewMember.name}</span>
            </div>
            {personTasks.length > 0 && (
              <ul className="tv-name-subs">
                {personTasks.map((task, index) => (
                  <li key={index}>{task}</li>
                ))}
              </ul>
            )}
            {note && <p className="tv-note">{note}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The largest and smallest text the TV is set in, in CSS pixels. */
const LARGEST = 40;
const SMALLEST = 8;

/**
 * Sets the board's text as large as it can be with everything on one screen:
 * the board is in rem, so the root size scales it all. Worked out again when
 * what is shown changes, and when the window does (the TV is the window).
 */
function useFit(dependencies: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const fit = () => {
      const board = ref.current;
      if (!board) return;
      const fits = (size: number) => {
        root.style.fontSize = `${size}px`;
        return board.scrollHeight <= window.innerHeight && board.scrollWidth <= window.innerWidth;
      };
      // The largest size that fits, to half a pixel.
      let low = SMALLEST;
      let high = Math.min(LARGEST, window.innerWidth / 48);
      if (fits(high)) return;
      while (high - low > 0.5) {
        const middle = (low + high) / 2;
        if (fits(middle)) low = middle;
        else high = middle;
      }
      fits(low);
    };

    fit();
    window.addEventListener('resize', fit);
    // The type is fetched on first use; fit again once it is in.
    void document.fonts.ready.then(fit);
    return () => window.removeEventListener('resize', fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return ref;
}
