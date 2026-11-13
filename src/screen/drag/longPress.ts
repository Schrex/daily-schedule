import type { Point } from './nameDrag';

/**
 * What a finger put down on a Crew Member's name is doing: still holding it,
 * scrolling the page, or (held long enough) lifting it. Pure: no DOM, no
 * timer. It is told where the finger is and what the time is, and says which
 * of the three it is. A finger that comes up or is taken away before the
 * lift simply ends the press (`useNameDrag`): there is nothing more to say
 * about it here. Once the name is lifted the drag itself is `nameDrag`'s,
 * exactly as with the mouse.
 */

/** How long (milliseconds) a finger must stay on a name before the name lifts. */
export const LONG_PRESS_MS = 350;

/**
 * How far (CSS pixels) a finger may tremble while holding a name. Further than
 * this before the lift, and it is scrolling the page.
 */
export const SCROLL_SLOP = 8;

export type Finger =
  /** Down on a name, and not yet any of the others. */
  | { readonly kind: 'holding'; readonly from: Point; readonly since: number }
  /** Held long enough: the name is in the air and the finger drags it. */
  | { readonly kind: 'lifted' }
  /** It moved first: the page scrolls and nothing is picked up. */
  | { readonly kind: 'scroll' };

/** A finger went down on a name at `at`, at the time `now` (milliseconds). */
export const fingerDown = (at: Point, now: number): Finger => ({
  kind: 'holding',
  from: at,
  since: now,
});

/** The finger moved to `at`. Before the lift, further than a tremble is a scroll. */
export function fingerMoved(finger: Finger, at: Point): Finger {
  if (finger.kind !== 'holding') return finger;
  const travelled = Math.hypot(at.x - finger.from.x, at.y - finger.from.y);
  return travelled > SCROLL_SLOP ? { kind: 'scroll' } : finger;
}

/** How long from `now` until a finger still holding lifts the name (0 when it is due). */
export function liftsIn(finger: Finger, now: number): number {
  if (finger.kind !== 'holding') return 0;
  return Math.max(0, finger.since + LONG_PRESS_MS - now);
}

/** The time is `now` and the finger has not gone anywhere: held long enough, the name lifts. */
export function fingerHeld(finger: Finger, now: number): Finger {
  if (finger.kind !== 'holding' || liftsIn(finger, now) > 0) return finger;
  return { kind: 'lifted' };
}
