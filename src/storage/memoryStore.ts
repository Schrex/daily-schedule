import type { DailySchedule, Roster, ScheduleDate } from '../schedule-rules';
import type { ScheduleStore } from './index';

/**
 * An in-memory ScheduleStore that forgets everything when the page closes.
 * For tests. It copies on the way in and out, as real storage does, so nothing
 * is shared with the caller by accident.
 */
export function memoryStore(): ScheduleStore {
  let roster: Roster | null = null;
  const schedules = new Map<ScheduleDate, DailySchedule>();

  return {
    loadRoster: async () => structuredClone(roster),
    saveRoster: async (next) => {
      roster = structuredClone(next);
    },
    listScheduleDates: async () => [...schedules.keys()].sort(),
    loadSchedule: async (date) => structuredClone(schedules.get(date) ?? null),
    saveSchedule: async (schedule) => {
      schedules.set(schedule.date, structuredClone(schedule));
    },
  };
}
