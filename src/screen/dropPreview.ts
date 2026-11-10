import {
  placeCrewMember,
  returnToNotPlaced,
  scheduleView,
  type DailySchedule,
  type Destination,
  type Roster,
  type ScheduleView,
} from '../schedule-rules';
import { NOT_PLACED_DROP, type DropKey } from './drag/nameDrag';

/**
 * What the screen draws while a name is dragged: the Daily Schedule as it
 * would be if the name were let go right now. So the dragged name is drawn
 * where it would land and the names there make room for it. Where that is
 * (Foreman first, then placement order; roster order in the Not Placed list)
 * is never worked out here: the schedule rules are asked to make the move,
 * and their view of the result is drawn.
 */

/** The destination a drop key stands for, or null when it stands for none. */
export function dropTarget(view: ScheduleView, over: DropKey): Destination | 'not-placed' | null {
  if (over === NOT_PLACED_DROP) return 'not-placed';
  return view.rows.find((row) => row.key === over)?.destination ?? null;
}

/**
 * The view to draw while `dragging` (who, and the destination under the
 * pointer). With nothing dragged, or the name over no destination, it is the
 * Daily Schedule as it stands.
 */
export function viewWhileDragging(
  roster: Roster,
  schedule: DailySchedule,
  dragging: { crewMemberId: string; over: DropKey | null } | null,
): ScheduleView {
  const view = scheduleView(roster, schedule);
  if (!dragging || dragging.over === null) return view;

  const to = dropTarget(view, dragging.over);
  if (to === null) return view;

  const dropped =
    to === 'not-placed'
      ? returnToNotPlaced(schedule, dragging.crewMemberId)
      : placeCrewMember(schedule, dragging.crewMemberId, to);
  return dropped === schedule ? view : scheduleView(roster, dropped);
}
