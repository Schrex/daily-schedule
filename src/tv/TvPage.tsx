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
import { crewPictureColumns, type PictureColumns } from '../send/crewPicture';
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

/** Whether two reads say the same thing (they are plain data, as stored). */
const sameShown = (a: Shown, b: Shown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Today's Daily Schedule, made to be read from across the office: the same
 * cards the crew is sent, side by side in columns across a wide screen,
 * sized to fill it with nothing to scroll. It changes by itself when the
 * Scheduler Sends or changes today's, and at midnight.
 *
 * Left alone it is the schedule and nothing else: no pointer, no buttons.
 * Moving the mouse brings back the pointer and a small bar with Full screen
 * and (for an Editor) Back to board; both fade away again after a few seconds
 * of stillness.
 * A click anywhere else also puts it full screen (or back).
 */
export function TvPage({ store, boardLink = true }: { store: ScheduleStore; boardLink?: boolean }) {
  const [shown, setShown] = useState<Shown | null>(null);
  /** Counts the reads begun, so only the latest one's result is shown. */
  const reads = useRef(0);

  const refresh = useCallback(() => {
    const thisRead = ++reads.current;
    read(store).then(
      (next) => {
        // A read begun later has already been (or will be) shown: this one is stale.
        if (thisRead !== reads.current) return;
        // The same as what is shown: keep it, so nothing is drawn or fitted again.
        setShown((current) => (current !== null && sameShown(current, next) ? current : next));
      },
      (error) => console.error('Could not read the Daily Schedule', error),
    );
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

  const awake = useMouseAwake();
  const fullScreen = useFullScreen();

  const toggleFullScreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="tv" data-awake={awake ? true : undefined} onClick={toggleFullScreen}>
      {shown && (shown.view ? <Board roster={shown.roster} view={shown.view} /> : <NothingYet today={shown.today} />)}
      <nav className="tv-controls" aria-label="TV controls" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="tv-control" onClick={toggleFullScreen}>
          {fullScreen ? 'Exit full screen' : 'Full screen'}
        </button>
        {boardLink && (
          <a className="tv-control" href="index.html">
            Back to board
          </a>
        )}
      </nav>
    </div>
  );
}

/** How long the pointer and the controls stay after the mouse last moved. */
const AWAKE_MS = 3000;

/** True while the mouse has moved in the last few seconds. */
function useMouseAwake(): boolean {
  const [awake, setAwake] = useState(false);
  useEffect(() => {
    let timer = 0;
    const wake = () => {
      setAwake(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setAwake(false), AWAKE_MS);
    };
    window.addEventListener('mousemove', wake);
    window.addEventListener('mousedown', wake);
    return () => {
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('mousedown', wake);
      window.clearTimeout(timer);
    };
  }, []);
  return awake;
}

/** True while the page is full screen. */
function useFullScreen(): boolean {
  const [fullScreen, setFullScreen] = useState(() => document.fullscreenElement !== null);
  useEffect(() => {
    const changed = () => setFullScreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  return fullScreen;
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

/**
 * The board in the crew picture's columns: two of Jobs and one at
 * the right for Shop, Trucking and Off Work, each card in the same column as
 * on the picture (worked out by the picture itself). Until that is known, the
 * Jobs and the rest stand in the same columns in order.
 */
function Board({ roster, view }: { roster: Roster; view: CrewView }) {
  const [columns, setColumns] = useState<PictureColumns | null>(null);
  useEffect(() => {
    let current = true;
    crewPictureColumns(view, roster).then(
      (worked) => current && setColumns(worked),
      (error) => console.error('Could not work out the columns', error),
    );
    return () => {
      current = false;
    };
  }, [view, roster]);

  const fitRef = useFit([view, columns]);
  const byKey = new Map(view.rows.map((row) => [row.key, row]));
  const shown = columns ?? firstGuess(view);

  return (
    <div className="tv-fit" ref={fitRef}>
      <header className="tv-head">
        <img className="tv-logo" src={logoUrl} alt="Schreiber Excavating" />
        <h1 className="tv-date">{fullDate(view.date)}</h1>
      </header>
      {/* The Notes for the day first, across the board, as on the crew picture. */}
      {view.dayNotes && view.dayNotes.length > 0 && (
        <section className="tv-card tv-day-notes">
          <h2 className="tv-card-name tv-card-name-yard">Notes</h2>
          {view.dayNotes.map((note, index) => (
            <p key={index} className="tv-day-note">
              {note}
            </p>
          ))}
        </section>
      )}
      <main
        className="tv-cards"
        style={{ gridTemplateColumns: shown.columns.map(({ share }) => `minmax(0, ${share}fr)`).join(' ') }}
      >
        {shown.columns.map(({ keys }, index) => (
          <div key={index} className="tv-column">
            {keys.flatMap((key) => {
              const row = byKey.get(key);
              return row ? [<Card key={key} roster={roster} row={row} />] : [];
            })}
          </div>
        ))}
      </main>
    </div>
  );
}

/** Jobs shared out over two columns in order, and the rest in a third: until the picture's own columns are known. */
function firstGuess(view: CrewView): PictureColumns {
  const jobs = view.rows.filter((row) => row.destination.kind === 'job').map((row) => row.key);
  const yard = view.rows.filter((row) => row.destination.kind !== 'job').map((row) => row.key);
  const jobColumns = Math.max(1, Math.min(2, jobs.length));
  const columns = Array.from({ length: jobColumns }, (_, index) => ({
    share: 1,
    keys: jobs.filter((_, at) => at % jobColumns === index),
  }));
  return { columns: yard.length > 0 ? [...columns, { share: 1, keys: yard }] : columns };
}

function Card({ roster, row }: { roster: Roster; row: ScheduleRow }) {
  const isJob = row.destination.kind === 'job';
  const quiet = row.destination.kind === 'standing-row' && row.destination.standingRow === 'off-work';
  const { name, number } = cardTitle(roster, row);
  return (
    <section className={`tv-card${quiet ? ' tv-card-quiet' : ''}`}>
      <div className="tv-card-head">
        <h2 className={`tv-card-name${isJob ? '' : ' tv-card-name-yard'}`}>
          {name}
          {number && <span className="tv-card-number">{number}</span>}
        </h2>
        <span className="tv-card-count">{row.who.length}</span>
      </div>
      {row.tasks.length > 0 && (
        <ul className={`tv-tasks${isJob ? '' : ' tv-tasks-yard'}`}>
          {row.tasks.map((task, index) => (
            <li key={index}>{task}</li>
          ))}
        </ul>
      )}
      <ul className="tv-names">
        {row.who.map(({ crewMember, note, personTasks = [] }) => (
          <li key={crewMember.id} className={`tv-name${crewMember.foreman ? ' tv-name-foreman' : ''}`}>
            <div className="tv-name-head">
              <span className={`tv-dot dot-${crewMember.color}`} />
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

/** Narrower than this (a phone), the board is one column that scrolls instead of fitting the screen. */
const NARROW = 700;

/**
 * The largest and smallest text the TV is set in, in CSS pixels. The largest
 * is high enough for a quiet day to fill a 4K TV shown at full size; the
 * width (`innerWidth / 48`) is what holds it back on a smaller screen.
 */
const LARGEST = 80;
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
      // On a phone the board is one column that scrolls, at the usual size.
      if (window.innerWidth < NARROW) {
        root.style.fontSize = '';
        return;
      }
      const fits = (size: number) => {
        root.style.fontSize = `${size}px`;
        return board.scrollHeight <= window.innerHeight && board.scrollWidth <= window.innerWidth;
      };
      // The largest size that fits, to half a pixel.
      let low = SMALLEST;
      // Never below the smallest, so a narrow window still gets the search.
      let high = Math.max(SMALLEST, Math.min(LARGEST, window.innerWidth / 48));
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
    return () => {
      window.removeEventListener('resize', fit);
      // Back to the usual size, for whatever shows next (the nothing-yet screen).
      root.style.fontSize = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return ref;
}
