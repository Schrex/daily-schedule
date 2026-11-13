/**
 * On a phone the Not Placed list is a badge with its count, so the Jobs keep
 * the screen: a tap opens the list over the board, and another closes it.
 * This says what the badge reads, what a tap on it does and whether the list
 * is over the board; the screen only draws it (and only a narrow screen's CSS
 * acts on it: on a wide window the list is always there, as it was).
 */

export interface Badge {
  /** How many are Not Placed. */
  notPlaced: number;
  /** Whether the Scheduler has the list open. */
  open: boolean;
  /** The first name of whoever was picked up from the list by a tap, if anyone. */
  moving?: string;
}

/** What the badge reads: what it is, and what a tap on it does (null: nothing). */
export function badgeWords({ notPlaced, open, moving }: Badge): { label: string; does: string | null } {
  if (moving !== undefined) return { label: `Moving ${moving}`, does: 'Put back' };
  if (notPlaced === 0) return { label: 'Everyone is placed', does: null };
  return { label: 'Not placed yet', does: open ? 'Close' : 'Show' };
}

/**
 * What a tap on the badge does. With someone picked up from the list it puts
 * them back (lets go of them); otherwise it opens the list, or closes it.
 */
export function badgeTap({ notPlaced, open, moving }: Badge): 'open' | 'close' | 'put-back' | 'nothing' {
  if (moving !== undefined) return 'put-back';
  if (notPlaced === 0) return 'nothing';
  return open ? 'close' : 'open';
}

/**
 * Whether the list is drawn over the board. An open list steps aside while a
 * name is in hand (picked up, or lifted by a drag), so the places under it
 * can be reached, and is back once the name is put somewhere or let go.
 */
export const listShown = (open: boolean, inHand: boolean): boolean => open && !inHand;

/**
 * Whether an open list is still open now. It stays open from one name to the
 * next, and closes with the last one placed: it does not spring open later,
 * when someone is put back on Not Placed.
 */
export const staysOpen = (open: boolean, notPlaced: number): boolean => open && notPlaced > 0;
