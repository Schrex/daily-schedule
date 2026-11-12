/**
 * The shapes the API takes in (a Roster, a Daily Schedule, a date), checked
 * only as far as keeping them safely needs: the pages' schedule rules own the
 * rest.
 */

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A date as YYYY-MM-DD. */
export const isDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

export const isRoster = (value: unknown): boolean =>
  isRecord(value) && Array.isArray(value.crewMembers) && Array.isArray(value.jobs);

export const isDailySchedule = (value: unknown): value is { date: string } =>
  isRecord(value) &&
  isDate(value.date) &&
  Array.isArray(value.placements) &&
  isRecord(value.tasks) &&
  Array.isArray(value.sends);
