import type { Fetch } from '../storage/apiStore';

/** The current sign-in token, or null when nobody is signed in. */
export type GetToken = () => Promise<string | null>;

/**
 * A fetch that sends the current sign-in token with each request
 * (`Authorization: Bearer <token>`). The token is asked for on every call, so
 * a refreshed one is used as soon as there is one. The API store and
 * GET /api/me both go through it.
 */
export function withToken(fetchFn: Fetch, getToken: GetToken): Fetch {
  return async (input, init) => {
    const token = await getToken();
    if (token === null) return fetchFn(input, init);
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetchFn(input, { ...init, headers });
  };
}
