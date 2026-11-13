/**
 * On a phone the header is one line once the board has scrolled, so the Jobs
 * get the screen, and opens again at the top. This says which it is; the
 * screen only draws it (and only a narrow screen's CSS acts on it).
 */

import type { ScheduleDate } from '../schedule-rules';

/** How far the board has scrolled, and how far it could scroll, in pixels. */
export interface BoardScroll {
  scrolled: number;
  room: number;
}

/** A nudge does not collapse the header: the board has to have scrolled this far. */
const COLLAPSE_AFTER = 40;

/**
 * A board with less than this left to scroll keeps the header open. The
 * collapsed header hands its height to the board; on a short board that
 * would leave nothing to scroll, and so no way to be "scrolled" at all.
 * More than the open header is tall on a phone.
 */
const ROOM_NEEDED = 320;

/**
 * Whether the header is collapsed, given whether it was. It collapses once
 * the board has scrolled, and stays so until the board is back at the top:
 * it does not flicker open and shut around one spot.
 */
export function headerCollapsed(was: boolean, { scrolled, room }: BoardScroll): boolean {
  if (was) return scrolled > 0;
  return scrolled >= COLLAPSE_AFTER && room >= ROOM_NEEDED;
}

/** The date in the collapsed header, short enough for one line beside the buttons: "Fri, Nov 13". */
export function collapsedDate(date: ScheduleDate): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
