import { fullDate, type ScheduleDate, type ScheduleView } from '../schedule-rules';

/**
 * Folded Jobs. A Job with nobody on it for the board's date does not take up
 * a full card: it is a button in a row under the cards. Folded is never
 * saved; it is worked out from the session's open set, the keys of the Job
 * rows drawn as cards. A Job is a card if its key is in the set, otherwise
 * it is folded. Only Jobs fold: Not Placed, Shop, Trucking and Off Work never.
 */
export type OpenJobs = ReadonlySet<string>;

/** What happened, as far as the open set is concerned. */
export type OpenJobsEvent =
  /**
   * The board was loaded or refreshed, the date was changed, or Send to crew
   * succeeded: the open set starts again from the Jobs that have someone on them.
   */
  | { kind: 'rebuild'; view: ScheduleView }
  /**
   * The Daily Schedule changed, by any means: every Job that has someone on it
   * now is opened. Nothing is closed, so a card emptied mid-edit stays a card.
   */
  | { kind: 'changed'; view: ScheduleView }
  /** The Scheduler tapped a folded Job's button. */
  | { kind: 'open'; jobKey: string }
  /**
   * The Scheduler tapped "Put away empty jobs": every open Job with nobody on
   * it folds now. Jobs with someone on them stay; their Tasks are untouched.
   */
  | { kind: 'put-away'; view: ScheduleView };

/** The keys of the Job rows with at least one person on them. */
const staffedJobKeys = (view: ScheduleView): string[] =>
  view.rows
    .filter((row) => row.destination.kind === 'job' && row.who.length > 0)
    .map((row) => row.key);

/**
 * The open set after an event: the one place it is worked out. Returns the
 * same set when nothing changes.
 */
export function nextOpenJobs(open: OpenJobs, event: OpenJobsEvent): OpenJobs {
  switch (event.kind) {
    case 'rebuild':
      return new Set(staffedJobKeys(event.view));
    case 'changed':
      return withKeys(open, staffedJobKeys(event.view));
    case 'open':
      return withKeys(open, [event.jobKey]);
    case 'put-away': {
      const staffed = new Set(staffedJobKeys(event.view));
      const kept = [...open].filter((key) => staffed.has(key));
      return kept.length === open.size ? open : new Set(kept);
    }
  }
}

/** The open Jobs with nobody on them: the cards "Put away empty jobs" would fold. */
export const emptyOpenJobKeys = (open: OpenJobs, view: ScheduleView): string[] =>
  view.rows
    .filter((row) => row.destination.kind === 'job' && open.has(row.key) && row.who.length === 0)
    .map((row) => row.key);

function withKeys(open: OpenJobs, keys: string[]): OpenJobs {
  if (keys.every((key) => open.has(key))) return open;
  return new Set([...open, ...keys]);
}

/**
 * The heading of the row of folded Jobs: "No crew tomorrow" when the board is
 * for the day after today, otherwise "No crew on Monday".
 */
export function foldedHeading(boardDate: ScheduleDate, today: ScheduleDate): string {
  const [year = 0, month = 1, day = 1] = today.split('-').map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  if (boardDate === tomorrow) return 'No crew tomorrow';
  return `No crew on ${fullDate(boardDate).split(',')[0]}`;
}
