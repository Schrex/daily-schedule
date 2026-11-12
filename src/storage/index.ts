/**
 * Storage: where the roster and the Daily Schedules are kept between visits.
 *
 * `ScheduleStore` is the whole interface. The pages use the Worker's database
 * through its API (apiStore.ts). Browser storage on one computer
 * (browserStore.ts) was the store before that, and is kept to read the old
 * data. Tests use the in-memory fake (memoryStore.ts). No rules live here: the
 * store only keeps and returns what it is given.
 */

import {
  dailyScheduleFor,
  nextWorkingDay,
  type DailySchedule,
  type Roster,
  type ScheduleDate,
} from '../schedule-rules';

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
 * Opens the store on the Daily Schedule for the next working day after
 * `today`. On first ever open (no roster saved yet) the seed roster and seed
 * Daily Schedule are saved first. The Daily Schedule returned is the one saved
 * for that day, or a new one created from the most recent earlier one.
 */
export async function openStore(
  store: ScheduleStore,
  seed: Opened,
  today: ScheduleDate,
): Promise<Opened> {
  let roster = await store.loadRoster();
  if (roster === null) {
    await store.saveRoster(seed.roster);
    roster = seed.roster;
  }
  // No Daily Schedule at all: start from the seed Daily Schedule.
  if ((await store.listScheduleDates()).length === 0) await store.saveSchedule(seed.schedule);

  return { roster, schedule: await openDate(store, roster, nextWorkingDay(today)) };
}

/**
 * The Daily Schedule to edit for a date: the one saved for it, or a new one
 * created by the schedule rules from the most recent earlier one and saved
 * under its own date. Daily Schedules for other dates are never touched.
 */
export async function openDate(
  store: ScheduleStore,
  roster: Roster,
  date: ScheduleDate,
): Promise<DailySchedule> {
  // The rules choose among whatever they are given; only these two can matter.
  const existing = await store.loadSchedule(date);
  const earlierDate = (await store.listScheduleDates()).filter((saved) => saved < date).at(-1);
  const earlier = earlierDate === undefined ? null : await store.loadSchedule(earlierDate);

  const saved = [existing, earlier].filter((schedule) => schedule !== null);
  const schedule = dailyScheduleFor(roster, saved, date);
  if (existing === null) await store.saveSchedule(schedule);
  return schedule;
}
