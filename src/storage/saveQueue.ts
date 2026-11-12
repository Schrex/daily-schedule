import type { DailySchedule, Roster, ScheduleDate } from '../schedule-rules';
import type { ScheduleStore } from './index';

/**
 * Where the saves stand: everything saved, saving (nothing has failed), or not
 * saved (a save failed and is being tried again).
 */
export type SaveState = 'saved' | 'saving' | 'not-saved';

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

/** A save waiting to be sent: what it saves (`key`, `value`), how to send it, and the callers waiting on it. */
interface Waiting {
  key: string;
  value: unknown;
  send: () => Promise<void>;
  done: (() => void)[];
}

/**
 * Puts a queue in front of a store's saves (the API-backed store, apiStore.ts),
 * so that the Scheduler's changes are saved reliably and in order:
 *
 * - Saves are sent one at a time, in the order they were made, so an older
 *   change never overwrites a newer one.
 * - If several saves for the same date (or several Roster saves) are waiting,
 *   only the latest is sent.
 * - A failed save is tried again with back-off until it gets through.
 *
 * The store returned has the same `ScheduleStore` interface; a save resolves
 * once what it saved, or a later save of the same thing, is saved, and never
 * rejects. `saves` reports all saved / saving / not saved for the pages.
 */
export function savedInOrder(
  inner: ScheduleStore,
  { wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }: SaveQueueOptions = {},
): { store: ScheduleStore; saves: Saves } {
  const queue: Waiting[] = [];
  /** The save at the head of the queue is on its way to the server: it can no longer be replaced. */
  let inFlight = false;
  let running = false;

  let state: SaveState = 'saved';
  const listeners = new Set<() => void>();
  const setState = (next: SaveState) => {
    if (next === state) return;
    state = next;
    listeners.forEach((listener) => listener());
  };

  const run = async () => {
    if (running) return;
    running = true;
    let failures = 0;
    while (queue.length > 0) {
      const save = queue[0]!;
      inFlight = true;
      try {
        await save.send();
      } catch (error) {
        inFlight = false;
        failures += 1;
        console.error('Could not save; trying again', error);
        setState('not-saved');
        await wait(retryAfter(failures));
        continue;
      }
      inFlight = false;
      failures = 0;
      queue.shift();
      save.done.forEach((done) => done());
      setState(queue.length > 0 ? 'saving' : 'saved');
    }
    running = false;
  };

  const enqueue = (key: string, value: unknown, send: () => Promise<void>): Promise<void> =>
    new Promise((done) => {
      const waiting = queue.find((save, i) => save.key === key && !(inFlight && i === 0));
      if (waiting) {
        Object.assign(waiting, { value, send });
        waiting.done.push(done);
      } else queue.push({ key, value, send, done: [done] });
      if (state === 'saved') setState('saving');
      void run();
    });

  /**
   * The newest value waiting to be saved under `key`, if any. Loads give it
   * back instead of the server's older copy, so a change not saved yet is
   * never lost by opening its date again.
   */
  const unsaved = <T>(key: string): T | undefined => {
    const save = queue.filter((waiting) => waiting.key === key).at(-1);
    return save && structuredClone(save.value as T);
  };
  const scheduleKey = (date: ScheduleDate) => `schedule/${date}`;

  const store: ScheduleStore = {
    loadRoster: async () => unsaved<Roster>('roster') ?? inner.loadRoster(),
    saveRoster: (roster) => {
      const copy = structuredClone(roster);
      return enqueue('roster', copy, () => inner.saveRoster(copy));
    },
    listScheduleDates: async () => {
      const waiting = queue.flatMap((save) => (save.key.startsWith('schedule/') ? [save.key.slice(9)] : []));
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
