import { API_BASE, ApiError, type Fetch } from '../storage/apiStore';

/** The pages: the Scheduler's screen (the board), Settings, and the Office TV. */
export type Page = 'board' | 'settings' | 'tv';

export type Role = 'editor' | 'viewer';

/** Who opened the page, as the API sees them (GET /api/me). */
export type Caller =
  | { kind: 'on-the-list'; email: string; role: Role }
  | { kind: 'not-on-the-list' }
  | { kind: 'not-signed-in' };

/** What the page does for them. */
export type Opening =
  /** The page itself. */
  | { kind: 'open' }
  /** A viewer is sent to the Office TV; they never create or save anything. */
  | { kind: 'go-to-tv' }
  /** A plain message: no access, and who to ask. */
  | { kind: 'no-access' }
  /** A link to the hub's sign-in page, and a note to come back. */
  | { kind: 'sign-in' };

/**
 * What a page shows to whoever opened it. Only editors open the board and
 * Settings; anyone on the list opens the Office TV.
 */
export function openingFor(page: Page, caller: Caller): Opening {
  if (caller.kind === 'not-signed-in') return { kind: 'sign-in' };
  if (caller.kind === 'not-on-the-list') return { kind: 'no-access' };
  if (page !== 'tv' && caller.role !== 'editor') return { kind: 'go-to-tv' };
  return { kind: 'open' };
}

/**
 * Asks the API who is calling (GET /api/me). 401 means not signed in and 403
 * not on the list; any other failure rejects with an ApiError, for the page to
 * show as a plain message.
 */
export async function askWhoIsCalling(fetchFn: Fetch, base: string = API_BASE): Promise<Caller> {
  let response: Response;
  try {
    response = await fetchFn(`${base}/me`);
  } catch (error) {
    throw new ApiError(`Could not reach the Daily Schedule's server (${String(error)}).`, 0);
  }
  if (response.status === 401) return { kind: 'not-signed-in' };
  if (response.status === 403) return { kind: 'not-on-the-list' };
  const answer = (await response.json().catch(() => null)) as { email?: unknown; role?: unknown; error?: string } | null;
  if (!response.ok) throw new ApiError(answer?.error ?? `The server answered ${response.status}.`, response.status);
  if (typeof answer?.email !== 'string' || (answer.role !== 'editor' && answer.role !== 'viewer')) {
    throw new ApiError('The server did not say who you are.', response.status);
  }
  return { kind: 'on-the-list', email: answer.email, role: answer.role };
}
