/**
 * What a press on a Crew Member's name is, from one pointer event to the next:
 * nothing yet, a press that may still turn out to be a plain click, or a drag
 * over (or outside) a destination. Pure: no DOM, no schedule rule. It only
 * says who is being dragged and which destination the pointer is over; what a
 * drop does is for the schedule rules.
 *
 * It also tells a double-click made with a shaky hand from a drag
 * (`shakyDoubleClick`).
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
    };

/** One Crew Member let go over one destination. */
export interface Drop {
  crewMemberId: string;
  over: DropKey;
}

export const idle: NameDrag = { kind: 'idle' };

/** The mouse button went down on a name. Not a drag yet. */
export const press = (crewMemberId: string, at: Point): NameDrag => ({
  kind: 'pressed',
  crewMemberId,
  from: at,
});

/**
 * The pointer moved to `at`, where `over` is the destination under it (if any).
 * A press becomes a drag once the pointer is the threshold away; a drag then
 * stays a drag wherever the pointer goes.
 */
export function moveTo(drag: NameDrag, at: Point, over: DropKey | null): NameDrag {
  if (drag.kind === 'idle') return drag;
  if (drag.kind === 'pressed') {
    const travelled = Math.hypot(at.x - drag.from.x, at.y - drag.from.y);
    if (travelled < DRAG_THRESHOLD) return drag;
  } else if (drag.over === over) {
    return drag;
  }
  return { kind: 'dragging', crewMemberId: drag.crewMemberId, over };
}

/** Escape, or the pointer was taken away: whatever was going on is off. */
export const cancel = (_drag: NameDrag): NameDrag => idle;

/**
 * The mouse button came up. A drag over a destination is a drop there; a press
 * that never became a drag, or a drag let go outside every destination, is not.
 */
export function release(drag: NameDrag): Drop | null {
  if (drag.kind !== 'dragging' || drag.over === null) return null;
  return { crewMemberId: drag.crewMemberId, over: drag.over };
}

/**
 * How soon (milliseconds) the second press of a double-click must follow the
 * first, and how long either press may be held. The usual setting of a
 * computer; the browser does not say what this one's is.
 */
export const DOUBLE_CLICK_INTERVAL = 500;

/** One press on a name, from the mouse button going down to it coming up. */
export interface Press {
  crewMemberId: string;
  /** The destination the name sat in when it was pressed. */
  home: DropKey | null;
  /** The destination under the pointer when the button came up. */
  letGoOver: DropKey | null;
  /** When the button went down and came up, in milliseconds. */
  downAt: number;
  upAt: number;
  /** True if the pointer moved far enough during the press to make it a drag. */
  dragged: boolean;
}

/** A press that began and ended on the name's own row, and was not held: as good as a click. */
const asGoodAsAClick = (press: Press): boolean =>
  press.home !== null &&
  press.letGoOver === press.home &&
  press.upAt - press.downAt <= DOUBLE_CLICK_INTERVAL;

/**
 * True when `second`, coming after `first`, is a double-click that the browser
 * will not report because the hand shook: two quick presses on the same name,
 * each ending on the name's own row, where the pointer slipped far enough
 * during one of them to make it a drag. Two steady clicks are not one of
 * these (the browser reports that double-click itself), and nor is a name let
 * go on another row, or held and put back: those are real drags.
 */
export function shakyDoubleClick(first: Press | null, second: Press): boolean {
  return (
    first !== null &&
    first.crewMemberId === second.crewMemberId &&
    (first.dragged || second.dragged) &&
    asGoodAsAClick(first) &&
    asGoodAsAClick(second) &&
    second.downAt - first.downAt <= DOUBLE_CLICK_INTERVAL
  );
}
