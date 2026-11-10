/**
 * How one name gets from where it was last seen to where the page now draws
 * it. Pure: boxes in, a decision out; no DOM.
 *
 * A name that stayed in its area (the table, the Not Placed list) slides
 * there. One that changed area, or was up in the air under the pointer,
 * cannot be seen crossing inside either area (each cuts off what leaves it),
 * so a copy of it flies over the page instead.
 */

/** Where a name is seen: its box in the window, and the area it is drawn in (null: in none, lifted). */
export interface Seen {
  x: number;
  y: number;
  width: number;
  height: number;
  area: unknown;
}

export type NameMove =
  | { readonly kind: 'stay' }
  /** Start this far from its place and slide in. */
  | { readonly kind: 'slide'; readonly dx: number; readonly dy: number }
  /** Start this far from its place, at this many times its size, and fly in. */
  | {
      readonly kind: 'fly';
      readonly dx: number;
      readonly dy: number;
      readonly scaleX: number;
      readonly scaleY: number;
    };

/** A move shorter than this (CSS pixels) cannot be seen: no motion for it. */
const VISIBLE = 1;

const stay: NameMove = { kind: 'stay' };

/** `before` is where the name was seen just before the page changed; undefined if it was not there. */
export function nameMove(before: Seen | undefined, now: Seen): NameMove {
  if (!before) return stay;
  const dx = before.x - now.x;
  const dy = before.y - now.y;

  if (before.area === null || before.area !== now.area) {
    return {
      kind: 'fly',
      dx,
      dy,
      scaleX: now.width > 0 ? before.width / now.width : 1,
      scaleY: now.height > 0 ? before.height / now.height : 1,
    };
  }
  return Math.abs(dx) < VISIBLE && Math.abs(dy) < VISIBLE ? stay : { kind: 'slide', dx, dy };
}
