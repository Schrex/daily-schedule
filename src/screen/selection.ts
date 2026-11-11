import { NOT_PLACED, type CrewMember, type PlacedCrewMember, type ScheduleView } from '../schedule-rules';

/**
 * What selecting a name means right now: the one place it is worked out.
 *
 * - Someone Not Placed is picked up to move: every place they can go is a
 *   target, and a click on one puts them there.
 * - Someone already placed has their panel open (their Person Tasks and Note
 *   with ×, and Add task / Add note under them): nothing is a target, and a
 *   click anywhere else lets go of them.
 */
export type Selection =
  | { mode: 'none' }
  | { mode: 'moving'; crewMember: CrewMember }
  | { mode: 'panel'; placed: PlacedCrewMember };

export function selectionOf(view: ScheduleView, selectedId: string | null): Selection {
  if (selectedId === null) return { mode: 'none' };
  const placed = view.rows.flatMap((row) => row.who).find((each) => each.crewMember.id === selectedId);
  if (placed) return { mode: 'panel', placed };
  const crewMember = view.notPlaced.find((each) => each.id === selectedId);
  return crewMember ? { mode: 'moving', crewMember } : { mode: 'none' };
}

/** The Crew Member selected, in whichever mode. */
export const selectedCrewMember = (selection: Selection): CrewMember | undefined =>
  selection.mode === 'moving'
    ? selection.crewMember
    : selection.mode === 'panel'
      ? selection.placed.crewMember
      : undefined;

/** Someone being moved, and the key of the row they are on now (that row stays plain). */
export interface InHand {
  crewMember: CrewMember;
  from: string;
}

/**
 * Who is in hand: picked up to move, or being dragged (a drag wins). Every
 * place but `from` is a target they can be put on.
 */
export function inHand(view: ScheduleView, selection: Selection, draggingId: string | null): InHand | undefined {
  const id = draggingId ?? (selection.mode === 'moving' ? selection.crewMember.id : null);
  if (id === null) return undefined;
  const row = view.rows.find((each) => each.who.some((placed) => placed.crewMember.id === id));
  const crewMember =
    row?.who.find((placed) => placed.crewMember.id === id)?.crewMember ??
    view.notPlaced.find((each) => each.id === id);
  return crewMember ? { crewMember, from: row?.key ?? NOT_PLACED } : undefined;
}

/** Whether the row or list with this key is a place the one in hand can go. */
export const isTarget = (hand: InHand | undefined, key: string): boolean =>
  hand !== undefined && hand.from !== key;

/**
 * What a click on a name does: select it, let go of the one selected, or
 * nothing here, so the click carries on to the card it is on (a move there).
 */
export function nameClick(selection: Selection, crewMemberId: string): 'select' | 'deselect' | 'pass-through' {
  if (selectedCrewMember(selection)?.id === crewMemberId) return 'deselect';
  return selection.mode === 'moving' ? 'pass-through' : 'select';
}
