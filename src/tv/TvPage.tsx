import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import logoUrl from '../assets/schreiber-logo.png';
import { loadCrewPage } from '../crew/CrewPage';
import { fullDate, sameData, type CrewView, type Roster } from '../schedule-rules';
import type { Fetch } from '../storage/apiStore';
import { CrewCards, useCrewColumns } from './CrewCards';

/** How often the TV looks again, besides whenever the Scheduler's screen saves. */
const LOOK_AGAIN_MS = 60_000;

/** What the TV last read: the newest Daily Schedule that has been Sent (none: null), and the Jobs its cards are drawn with. */
interface Shown {
  roster: Roster;
  view: CrewView | null;
}

/**
 * Reads what the TV should show: what the Crew Page shows, the newest Daily
 * Schedule that has been Sent, exactly as the crew got it (the API's
 * /crew-page). So the office sees what the crew sees, and never a Daily
 * Schedule that has not been Sent.
 */
async function read(fetchFn?: Fetch): Promise<Shown> {
  const { jobs, sent } = await loadCrewPage(fetchFn);
  return { roster: { crewMembers: [], jobs }, view: sent?.view ?? null };
}

/**
 * The newest Daily Schedule that has been Sent, the same one the Crew Page
 * shows, made to be read from across the office: the same cards the crew is
 * sent, side by side in columns across a wide screen, sized to fill it with
 * nothing to scroll. It changes by itself when the Scheduler Sends.
 *
 * Left alone it is the schedule and nothing else: no pointer, no buttons.
 * Moving the mouse brings back the pointer and a small bar with Full screen
 * and (for an Editor) Back to board; both fade away again after a few seconds
 * of stillness.
 * A click anywhere else also puts it full screen (or back).
 */
export function TvPage({ fetchFn, boardLink = true }: { fetchFn?: Fetch; boardLink?: boolean }) {
  const [shown, setShown] = useState<Shown | null>(null);
  /** Counts the reads begun, so only the latest one's result is shown. */
  const reads = useRef(0);

  const refresh = useCallback(() => {
    const thisRead = ++reads.current;
    read(fetchFn).then(
      (next) => {
        // A read begun later has already been (or will be) shown: this one is stale.
        if (thisRead !== reads.current) return;
        // The same as what is shown: keep it, so nothing is drawn or fitted again.
        setShown((current) => (current !== null && sameData(current, next) ? current : next));
      },
      (error) => console.error('Could not read the Daily Schedule', error),
    );
  }, [fetchFn]);

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
      {shown && (shown.view ? <Board roster={shown.roster} view={shown.view} /> : <NothingYet />)}
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

function NothingYet() {
  return (
    <div className="tv-empty">
      <img className="tv-logo" src={logoUrl} alt="Schreiber Excavating" />
      <p className="tv-empty-text">The Daily Schedule shows here as soon as it is Sent.</p>
    </div>
  );
}

/**
 * The board: the logo and the date over the cards the crew is sent
 * (CrewCards.tsx), sized to fill the screen.
 */
function Board({ roster, view }: { roster: Roster; view: CrewView }) {
  const columns = useCrewColumns(view, roster);
  const fitRef = useFit([view, columns]);

  return (
    <div className="tv-fit" ref={fitRef}>
      <header className="tv-head">
        <img className="tv-logo" src={logoUrl} alt="Schreiber Excavating" />
        <h1 className="tv-date">{fullDate(view.date)}</h1>
      </header>
      <CrewCards roster={roster} view={view} columns={columns} />
    </div>
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
