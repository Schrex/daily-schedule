/**
 * What a press on a Crew Member's name is, from one pointer event to the next:
 * nothing yet, a press that may still turn out to be a plain click, or a drag
 * over (or outside) a destination. Pure: no DOM, no schedule rule. It only
 * says who is being dragged and which destination the pointer is over; what a
 * drop does is for the schedule rules.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * How far (CSS pixels) the pointer must travel from where it was pressed
 * before the press is a drag. Below this, a shaky click is still a click.
 */
export const DRAG_THRESHOLD = 6;

/** The name a destination is known by while dragging. Whoever marks the destinations chooses them. */
export type DropKey = string;

export type NameDrag =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pressed'; readonly crewMemberId: string; readonly from: Point }
  | {
      readonly kind: 'dragging';
      readonly crewMemberId: string;
      /** The destination under the pointer, or null when it is over none. */
      readonly over: DropKey | null;
      /** The spot in it: just before this Crew Member, or null for the end. */
      readonly before: string | null;
    };

/** One Crew Member let go over one destination, at a spot in it (see `spotAt`). */
export interface Drop {
  crewMemberId: string;
  over: DropKey;
  before: string | null;
}

export const idle: NameDrag = { kind: 'idle' };

/** The mouse button went down on a name. Not a drag yet. */
export const press = (crewMemberId: string, at: Point): NameDrag => ({
  kind: 'pressed',
  crewMemberId,
  from: at,
});

/**
 * The pointer moved to `at`, where `over` is the destination under it (if any)
 * and `before` the spot in it (see `spotAt`). A press becomes a drag once the
 * pointer is the threshold away; a drag then stays a drag wherever the pointer
 * goes. While neither the destination nor the spot changes it is the same drag.
 */
export function moveTo(
  drag: NameDrag,
  at: Point,
  over: DropKey | null,
  before: string | null = null,
): NameDrag {
  if (drag.kind === 'idle') return drag;
  if (drag.kind === 'pressed') {
    const travelled = Math.hypot(at.x - drag.from.x, at.y - drag.from.y);
    if (travelled < DRAG_THRESHOLD) return drag;
  } else if (drag.over === over && drag.before === before) {
    return drag;
  }
  return { kind: 'dragging', crewMemberId: drag.crewMemberId, over, before };
}

/** Where one name is drawn in a destination, top to bottom (CSS pixels). */
export interface NameBox {
  crewMemberId: string;
  top: number;
  bottom: number;
}

/**
 * The spot in a destination the pointer's height points at: just before the
 * first name whose middle is below it, or null (the end) when there is none.
 * `names` are the names drawn there, in the order they are listed. The
 * dragged name's own chip is ignored: it is drawn wherever it would land, so
 * counting it would move the spot each time the names make room.
 */
export function spotAt(y: number, names: readonly NameBox[], dragged: string): string | null {
  const below = names.find(
    (name) => name.crewMemberId !== dragged && (name.top + name.bottom) / 2 > y,
  );
  return below?.crewMemberId ?? null;
}

/** Escape, or the pointer was taken away: whatever was going on is off. */
export const cancel = (_drag: NameDrag): NameDrag => idle;

/**
 * The mouse button came up. A drag over a destination is a drop there; a press
 * that never became a drag, or a drag let go outside every destination, is not.
 */
export function release(drag: NameDrag): Drop | null {
  if (drag.kind !== 'dragging' || drag.over === null) return null;
  return { crewMemberId: drag.crewMemberId, over: drag.over, before: drag.before };
}
