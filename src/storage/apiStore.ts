import type { DailySchedule, Roster, ScheduleDate } from '../schedule-rules';
import type { ScheduleStore } from './index';

/** Where the pages find the Worker's API: on their own address, under /daily-schedule/. */
export const API_BASE = '/daily-schedule/api';

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** A request to the API that was refused or failed; `status` is the HTTP status (0 when unreachable). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * The ScheduleStore kept by the Worker in its database (D1), shared by every
 * computer, phone and the Office TV. Each call is one request to the API
 * (worker/src/api.ts), and a refused or failed one rejects with an ApiError.
 * The Worker decides who is calling (worker/src/signIn.ts).
 */
export function apiStore(base: string = API_BASE, fetchFn: Fetch = (input, init) => fetch(input, init)): ScheduleStore {
  const request = async (path: string, init?: RequestInit): Promise<Response> => {
    let response: Response;
    try {
      response = await fetchFn(base + path, init);
    } catch (error) {
      throw new ApiError(`Could not reach the Daily Schedule's server (${String(error)}).`, 0);
    }
    if (!response.ok) {
      const answer = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new ApiError(answer?.error ?? `The server answered ${response.status}.`, response.status);
    }
    return response;
  };
  const get = async <T>(path: string): Promise<T> => (await request(path)).json() as Promise<T>;
  const put = async (path: string, body: unknown): Promise<void> => {
    await request(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  return {
    loadRoster: () => get<Roster | null>('/roster'),
    saveRoster: (roster) => put('/roster', roster),
    listScheduleDates: () => get<ScheduleDate[]>('/schedules'),
    loadSchedule: (date) => get<DailySchedule | null>(`/schedules/${encodeURIComponent(date)}`),
    saveSchedule: (schedule) => put(`/schedules/${encodeURIComponent(schedule.date)}`, schedule),
  };
}
