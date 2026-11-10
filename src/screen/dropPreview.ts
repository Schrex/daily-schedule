import {
  moveCrewMember,
  NOT_PLACED,
  scheduleView,
  type DailySchedule,
  type MoveTo,
  type Roster,
  type ScheduleView,
} from '../schedule-rules';
import type { DropKey } from './drag/nameDrag';

/**
 * What the screen draws while a name is dragged: the Daily Schedule as it
 * would be if the name were let go right now. So the dragged name is drawn
 * where it would land and the names there make room for it. Where that is
 * (Foreman first, then placement order; roster order in the Not Placed list)
 * is never worked out here: the schedule rules are asked to make the move,
 * and their view of the result is drawn.
 */

/**
 * Where a drop key says to move to, or null when it stands for nowhere. The
 * screen marks each row with the row's key and the Not Placed list with
 * `NOT_PLACED` (no row has that key: row keys all have a colon).
 */
export function dropTarget(view: ScheduleView, over: DropKey): MoveTo | null {
  if (over === NOT_PLACED) return NOT_PLACED;
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

  const dropped = moveCrewMember(schedule, dragging.crewMemberId, to);
  return dropped === schedule ? view : scheduleView(roster, dropped);
}
