import type { Opened, ScheduleStore } from './index';
import type { SaveState, Saves } from './saveQueue';

/**
 * Reload on focus: a page that comes back to the front loads what is saved
 * again, so a board left open on one device never saves over changes made on
 * another. It does so only when the save queue says everything is saved;
 * while a change is still being saved (or could not be), the focus does
 * nothing, so the reload never drops that change.
 */
export const reloadsOnFocus = (state: SaveState): boolean => state === 'saved';

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
    roster: roster === null || same(roster, onScreen.roster) ? onScreen.roster : roster,
    schedule: schedule === null || same(schedule, onScreen.schedule) ? onScreen.schedule : schedule,
  };
  return found.roster === onScreen.roster && found.schedule === onScreen.schedule ? null : found;
}

/** Whether two saved things are the same once saved: the order of keys and keys with no value do not count. */
const same = (a: unknown, b: unknown): boolean => asSaved(a) === asSaved(b);

const asSaved = (value: unknown): string =>
  JSON.stringify(value, (_key, part: unknown) =>
    part !== null && typeof part === 'object' && !Array.isArray(part)
      ? Object.fromEntries(Object.entries(part).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : part,
  );
