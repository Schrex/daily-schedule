import type { DailySchedule, Roster, ScheduleDate } from '../schedule-rules';
import { ApiError } from './apiStore';
import type { ScheduleStore } from './index';

/**
 * Where the saves stand: everything saved, saving (nothing has failed), or not
 * saved (a save failed and is being tried again). Or the server refused a
 * save, and trying again would only be refused again, so the queue stops:
 * the sign-in has run out (`sign-in-again`), the caller may not save
 * (`no-access`), or the server would not take what was sent (`refused`).
 */
export type SaveState = 'saved' | 'saving' | 'not-saved' | 'sign-in-again' | 'no-access' | 'refused';

/** The refusals that stop the queue, by HTTP status. */
const REFUSED: Partial<Record<number, SaveState>> = { 400: 'refused', 401: 'sign-in-again', 403: 'no-access' };

/** The save queue's state, for the pages to show; `subscribe` returns how to stop listening. */
export interface Saves {
  state(): SaveState;
  subscribe(listener: () => void): () => void;
}

export interface SaveQueueOptions {
  /** Waits that long before trying a failed save again. Tests pass a clock they move on themselves. */
  wait?: (ms: number) => Promise<void>;
}

/** How long to wait before trying again after the nth failure in a row: 1 s, 2 s, 4 s… up to 30 s. */
export const retryAfter = (failures: number): number => Math.min(1000 * 2 ** (failures - 1), 30_000);

/** A save waiting to be sent: what it saves (`key`, `value`) and how to send it. */
interface Waiting {
  key: string;
  value: unknown;
  send: () => Promise<void>;
}

/** The queue's key for a date's Daily Schedule: this prefix, then the date. */
const SCHEDULE_KEY = 'schedule/';
const scheduleKey = (date: ScheduleDate) => `${SCHEDULE_KEY}${date}`;

/**
 * Puts a queue in front of a store's saves (the API-backed store, apiStore.ts),
 * so that the Scheduler's changes are saved reliably and in order:
 *
 * - Saves are sent one at a time, in the order they were made, so an older
 *   change never overwrites a newer one.
 * - If several saves for the same date (or several Roster saves) are waiting,
 *   only the latest is sent.
 * - A failed save is tried again with back-off until it gets through, unless
 *   the server refused it (400, 401, 403): then nothing more is sent, and
 *   `saves` says why.
 *
 * The store returned has the same `ScheduleStore` interface. A save resolves
 * as soon as the queue has it (loads already give it back) and never rejects,
 * so opening a page or a date never waits on the server taking a save; how
 * the saves are going is `saves`, which the pages show.
 */
export function savedInOrder(
  inner: ScheduleStore,
  { wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }: SaveQueueOptions = {},
): { store: ScheduleStore; saves: Saves } {
  const queue: Waiting[] = [];
  /** The save at the head of the queue is on its way to the server: it can no longer be replaced. */
  let inFlight = false;
  let running = false;
  /** A save was refused (see SaveState): nothing more is sent. */
  let stopped = false;

  let state: SaveState = 'saved';
  const listeners = new Set<() => void>();
  const setState = (next: SaveState) => {
    if (next === state) return;
    state = next;
    listeners.forEach((listener) => listener());
  };

  const run = async () => {
    if (running || stopped) return;
    running = true;
    let failures = 0;
    while (queue.length > 0) {
      const save = queue[0]!;
      inFlight = true;
      try {
        await save.send();
      } catch (error) {
        inFlight = false;
        const refused = error instanceof ApiError ? REFUSED[error.status] : undefined;
        if (refused) {
          // Trying again would be refused again: stop, keeping every change for the page.
          console.error('The server refused a save; not trying again', error);
          stopped = true;
          running = false;
          setState(refused);
          return;
        }
        failures += 1;
        console.error('Could not save; trying again', error);
        setState('not-saved');
        await wait(retryAfter(failures));
        continue;
      }
      inFlight = false;
      failures = 0;
      queue.shift();
      setState(queue.length > 0 ? 'saving' : 'saved');
    }
    running = false;
  };

  const enqueue = async (key: string, value: unknown, send: () => Promise<void>): Promise<void> => {
    const waiting = queue.find((save, i) => save.key === key && !(inFlight && i === 0));
    if (waiting) Object.assign(waiting, { value, send });
    else queue.push({ key, value, send });
    if (state === 'saved') setState('saving');
    void run();
  };

  /**
   * The newest value waiting to be saved under `key`, if any. Loads give it
   * back instead of the server's older copy, so a change not saved yet is
   * never lost by opening its date again.
   */
  const unsaved = <T>(key: string): T | undefined => {
    const save = queue.filter((waiting) => waiting.key === key).at(-1);
    return save && structuredClone(save.value as T);
  };

  const store: ScheduleStore = {
    loadRoster: async () => unsaved<Roster>('roster') ?? inner.loadRoster(),
    saveRoster: (roster) => {
      const copy = structuredClone(roster);
      return enqueue('roster', copy, () => inner.saveRoster(copy));
    },
    listScheduleDates: async () => {
      const waiting = queue.flatMap((save) => (save.key.startsWith(SCHEDULE_KEY) ? [save.key.slice(SCHEDULE_KEY.length)] : []));
      return [...new Set([...(await inner.listScheduleDates()), ...waiting])].sort();
    },
    loadSchedule: async (date) => unsaved<DailySchedule>(scheduleKey(date)) ?? inner.loadSchedule(date),
    saveSchedule: (schedule) => {
      const copy = structuredClone(schedule);
      return enqueue(scheduleKey(copy.date), copy, () => inner.saveSchedule(copy));
    },
  };
  const saves: Saves = {
    state: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return { store, saves };
}
