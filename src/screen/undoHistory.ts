import type { DailySchedule } from '../schedule-rules';

/**
 * Undo: the Daily Schedules as they were before each of the Scheduler's
 * edits this session, the latest last. Never saved; it starts empty when the
 * board is opened and when another date is opened.
 */
export type UndoHistory = readonly DailySchedule[];

/** How many edits can be taken back. */
export const UNDO_LIMIT = 50;

export const emptyHistory: UndoHistory = [];

/** An edit changed the schedule: remember how it was before. */
export function remember(history: UndoHistory, before: DailySchedule): UndoHistory {
  return [...history, before].slice(-UNDO_LIMIT);
}

/**
 * Takes back the latest edit: the schedule as it was before it, and what is
 * left to undo. Undo never takes back a Send: the send record stays as it is
 * now, so a schedule changed back after a Send is still sent as UPDATED.
 * Null when there is nothing to undo.
 */
export function undo(
  history: UndoHistory,
  current: DailySchedule,
): { schedule: DailySchedule; history: UndoHistory } | null {
  const before = history.at(-1);
  if (!before) return null;
  return { schedule: { ...before, sends: current.sends }, history: history.slice(0, -1) };
}
