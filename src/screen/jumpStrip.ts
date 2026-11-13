/**
 * On a phone the cards are one long column. A strip of their names can be
 * swiped along and tapped to jump straight to one: every open Job, then Shop,
 * Trucking and Off Work. This says what the strip lists and how far a jump
 * scrolls; the screen only draws it (and only a narrow screen's CSS shows it).
 */

import { cardTitle, type Roster, type ScheduleView } from '../schedule-rules';
import type { OpenJobs } from './openJobs';

/** One name on the strip, and the key of the card it jumps to. */
export interface JumpStop {
  key: string;
  name: string;
}

/**
 * The strip: every Job drawn as a card, in the order of the board, then the
 * Standing Rows. A folded Job has no card to jump to, so it is not on it.
 */
export function jumpStrip(roster: Roster, view: ScheduleView, open: OpenJobs): JumpStop[] {
  const stop = (row: ScheduleView['rows'][number]): JumpStop => ({ key: row.key, name: cardTitle(roster, row).name });
  return [
    ...view.rows.filter((row) => row.destination.kind === 'job' && open.has(row.key)).map(stop),
    ...view.rows.filter((row) => row.destination.kind === 'standing-row').map(stop),
  ];
}

/** Where things are on the screen when a name on the strip is tapped, in pixels from its top. */
export interface JumpFrom {
  /** The top of the card to jump to. */
  cardTop: number;
  /** The top of the page of cards: just under the header. */
  pageTop: number;
  /** How far down the page is covered by what stays over it (the Not Placed list); the page's top or less if nothing. */
  coveredTo: number;
  /** The gap left above the card. */
  air: number;
}

/**
 * How far the page of cards scrolls (down, or back if less than nothing) so
 * the card's top is just under whatever is over the page's top. The header is
 * above the page and the bottom bar under it, so the card is clear of both.
 */
export function jumpDistance({ cardTop, pageTop, coveredTo, air }: JumpFrom): number {
  return cardTop - Math.max(pageTop, coveredTo) - air;
}
