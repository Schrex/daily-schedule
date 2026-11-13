import { sameData, type ScheduleEdit } from '../schedule-rules';
import type { Opened, ScheduleStore } from './index';
import type { SaveState, Saves } from './saveQueue';

/**
 * Reload on focus: a page that comes back to the front loads what is saved
 * again, so a board left open on one device never saves over changes made on
 * another. It does so only when the save queue says everything is saved;
 * while a change is still being saved (or could not be), the focus does
 * nothing, so the reload never drops that change. Nor does it while a text
 * field on the board has the focus (`typing`): text still being typed is not
 * in the save queue, and a reload would drop it or put it on another line.
 */
export const reloadsOnFocus = (state: SaveState, typing = false): boolean => state === 'saved' && !typing;

/**
 * What a focus finds for the board: the Roster and the Daily Schedule for the
 * date on the screen, as they are saved now. Null when there is nothing to
 * do: a change is not saved yet (before the load or by the time it answers),
 * or what is saved is what is on the screen.
 *
 * Otherwise each part found is the saved one where it differs, and the very
 * object from `onScreen` where it does not, so the page can tell which
 * changed. A Roster or Daily Schedule the server no longer has is left as it
 * is on the screen. Nothing is ever saved or created here.
 */
export async function reloadOnFocus(store: ScheduleStore, saves: Saves, onScreen: Opened): Promise<Opened | null> {
  if (!reloadsOnFocus(saves.state())) return null;
  const [roster, schedule] = await Promise.all([store.loadRoster(), store.loadSchedule(onScreen.schedule.date)]);
  // A change made while the load was on its way: it wins, the load is dropped.
  if (!reloadsOnFocus(saves.state())) return null;

  const found: Opened = {
    roster: roster === null || sameData(roster, onScreen.roster) ? onScreen.roster : roster,
    schedule: schedule === null || sameData(schedule, onScreen.schedule) ? onScreen.schedule : schedule,
  };
  return found.roster === onScreen.roster && found.schedule === onScreen.schedule ? null : found;
}

/** The board, as its reloads see it: the page fills this in (App.tsx); the tests use a plain one. */
export interface Board {
  /** The Roster and the Daily Schedule on the screen now. */
  onScreen(): Opened;
  /** Whether a text field on the board has the focus. */
  typing(): boolean;
  /** Puts what a reload found on the screen, in place of what is there. */
  show(found: Opened): void;
  /** Applies one of the Scheduler's edits to the board as it stands now, and saves it. */
  edit(edit: ScheduleEdit): void;
}

/**
 * The board's reloads on focus, one at a time, and what happens to what the
 * Scheduler does while one is on its way:
 *
 * - An edit made meanwhile is held, and applied on top of what the reload
 *   found once it has answered (or failed), in the order made. So the first
 *   click after coming back never saves the old Daily Schedule over a newer
 *   one. The page asks `hold` before applying any edit.
 * - Send waits for `settled`, so the picture is of the Daily Schedule as
 *   loaded, with the held edits on it.
 * - What a reload found is not shown if the board has moved on meanwhile (a
 *   Send recorded, another date opened).
 * - While a text field has the focus there is no reload, and one that was on
 *   its way when the typing began is not shown. The reload is owed instead:
 *   the page calls `again` when a field is left and when a save finishes,
 *   and it goes ahead once no field has the focus and everything is saved.
 */
export function boardReloads(store: ScheduleStore, saves: Saves, board: Board) {
  let onItsWay: Promise<void> | null = null;
  const held: ScheduleEdit[] = [];
  /** A focus came while a field had the focus: reload when it can be done. */
  let owed = false;

  const reload = async () => {
    const onScreen = board.onScreen();
    try {
      const found = await reloadOnFocus(store, saves, onScreen);
      if (found && board.onScreen().schedule === onScreen.schedule) {
        if (board.typing()) owed = true;
        else board.show(found);
      }
    } catch (error) {
      console.error('Could not reload the Daily Schedule', error);
    } finally {
      onItsWay = null;
      held.splice(0).forEach((edit) => board.edit(edit));
    }
  };

  const focus = () => {
    if (onItsWay) return;
    if (board.typing()) {
      owed = true;
      return;
    }
    if (!reloadsOnFocus(saves.state())) return;
    owed = false;
    onItsWay = reload();
  };

  return {
    /** The page came back to the front. */
    focus,
    /** A text field was left, or a save finished: the reload owed, if any, is tried now. */
    again: () => {
      if (owed) focus();
    },
    /** An edit the Scheduler just made. True when it was held for the reload on its way; false: apply it now. */
    hold: (edit: ScheduleEdit): boolean => {
      if (!onItsWay) return false;
      held.push(edit);
      return true;
    },
    /** Whether a reload is on its way. */
    reloading: (): boolean => onItsWay !== null,
    /** Resolves once no reload is on its way and every held edit is on the board. */
    settled: (): Promise<void> => onItsWay ?? Promise.resolve(),
  };
}

export type BoardReloads = ReturnType<typeof boardReloads>;
