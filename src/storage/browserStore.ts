import type { DailySchedule, Roster, ScheduleDate } from '../schedule-rules';
import type { ScheduleStore } from './index';

const ROSTER_KEY = 'daily-schedule/roster';
const SCHEDULE_KEY_PREFIX = 'daily-schedule/schedule/';

/**
 * The ScheduleStore kept in browser storage on the Scheduler's computer: the
 * roster under one key and each Daily Schedule under a key of its own date.
 * Writes land before the function returns, so closing the window straight
 * after a change loses nothing.
 */
export function browserStore(storage: Storage = window.localStorage): ScheduleStore {
  const read = <T>(key: string): T | null => {
    const saved = storage.getItem(key);
    return saved === null ? null : (JSON.parse(saved) as T);
  };

  return {
    loadRoster: async () => read<Roster>(ROSTER_KEY),
    saveRoster: async (roster) => storage.setItem(ROSTER_KEY, JSON.stringify(roster)),
    listScheduleDates: async () => {
      const dates: ScheduleDate[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key?.startsWith(SCHEDULE_KEY_PREFIX)) dates.push(key.slice(SCHEDULE_KEY_PREFIX.length));
      }
      return dates.sort();
    },
    loadSchedule: async (date) => read<DailySchedule>(SCHEDULE_KEY_PREFIX + date),
    saveSchedule: async (schedule) =>
      storage.setItem(SCHEDULE_KEY_PREFIX + schedule.date, JSON.stringify(schedule)),
  };
}
