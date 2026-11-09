/**
 * Storage: where the roster and the Daily Schedules are kept between visits.
 *
 * `ScheduleStore` is the whole interface. Today it is backed by browser
 * storage on the Scheduler's computer (browserStore.ts); a hosted database can
 * replace that by implementing the same five functions. Tests use the
 * in-memory fake (memoryStore.ts). No rules live here: the store only keeps
 * and returns what it is given.
 */

import type { DailySchedule, Roster, ScheduleDate } from '../schedule-rules';

export interface ScheduleStore {
  /** The saved roster, or null if nothing has ever been saved. */
  loadRoster(): Promise<Roster | null>;
  saveRoster(roster: Roster): Promise<void>;
  /** The dates that have a saved Daily Schedule, earliest first. */
  listScheduleDates(): Promise<ScheduleDate[]>;
  /** The Daily Schedule saved for that date, or null if there is none. */
  loadSchedule(date: ScheduleDate): Promise<DailySchedule | null>;
  /** Saves the Daily Schedule under its own date, replacing any saved one. */
  saveSchedule(schedule: DailySchedule): Promise<void>;
}

/** What the screen needs to start: the roster and the Daily Schedule to edit. */
export interface Opened {
  roster: Roster;
  schedule: DailySchedule;
}

/**
 * Opens the store. On first ever open (no roster saved yet) the seed roster
 * and seed Daily Schedule are saved and returned. After that, the saved roster
 * and the saved Daily Schedule with the latest date are returned.
 */
export async function openStore(store: ScheduleStore, seed: Opened): Promise<Opened> {
  const roster = await store.loadRoster();
  if (roster === null) {
    await store.saveRoster(seed.roster);
    await store.saveSchedule(seed.schedule);
    return seed;
  }

  const latestDate = (await store.listScheduleDates()).at(-1);
  const schedule = latestDate === undefined ? null : await store.loadSchedule(latestDate);
  if (schedule !== null) return { roster, schedule };

  // A roster but no Daily Schedule: start again from the seed Daily Schedule.
  await store.saveSchedule(seed.schedule);
  return { roster, schedule: seed.schedule };
}
