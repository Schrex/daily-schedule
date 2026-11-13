/**
 * On a phone the header is one line once the board has scrolled, so the Jobs
 * get the screen, and opens again at the top. This says which it is; the
 * screen only draws it (and only a narrow screen's CSS acts on it).
 */

import type { ScheduleDate } from '../schedule-rules';

/**
 * How far the board has scrolled and how far it could scroll, and how tall
 * the open header is, in pixels.
 */
export interface BoardScroll {
  scrolled: number;
  room: number;
  header: number;
}

/** A nudge does not collapse the header: the board has to have scrolled this far. */
const COLLAPSE_AFTER = 40;

/** The collapsed header is never shorter than this: one line of buttons a fingertip tall. */
const ONE_LINE = 40;

/**
 * Whether the header is collapsed, given whether it was. It collapses once
 * the board has scrolled, and stays so until the board is back at the top:
 * it does not flicker open and shut around one spot.
 *
 * The collapsed header hands its height to the board, which then has that
 * much less to scroll. So it collapses only when the board has more room
 * than the most it can be handed (the open header, less one line): then the
 * board is still scrolled afterwards, wherever it was, and the header does
 * not open again by itself. That holds at the very end of a short board too,
 * where a fling to Off Work leaves it. On a board with less room than that
 * the header stays open: collapsed, there would be nothing left to scroll.
 */
export function headerCollapsed(was: boolean, { scrolled, room, header }: BoardScroll): boolean {
  if (was) return scrolled > 0;
  return scrolled >= COLLAPSE_AFTER && room > header - ONE_LINE;
}

/**
 * What is on the screen, in one word, for the names that travel when they
 * move (`MoveNames`): the date, and whether the header is collapsed. When it
 * changes nothing travels. Collapsing or opening the header shifts every
 * name on the board, and that is not a move.
 */
export const sceneOnScreen = (date: ScheduleDate, collapsed: boolean): string =>
  `${date} ${collapsed ? 'collapsed' : 'open'}`;
