import { describe, expect, it } from 'vitest';
import { apiStore } from '../storage/apiStore';
import { withToken } from './withToken';

/** A fetch that records each request's headers. */
const recording = () => {
  const seen: { url: string; authorization: string | null; contentType: string | null }[] = [];
  const fetchFn = async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    seen.push({ url, authorization: headers.get('Authorization'), contentType: headers.get('Content-Type') });
    return Response.json(null);
  };
  return { seen, fetchFn };
};

describe('sending the sign-in with every API call', () => {
  it('sends the current token with each of the store\'s calls, keeping their own headers', async () => {
    const server = recording();
    let token = 'first';
    const store = apiStore('/api', withToken(server.fetchFn, async () => token));

    await store.loadRoster();
    token = 'refreshed';
    await store.saveRoster({ crewMembers: [], jobs: [] });

    expect(server.seen).toEqual([
      { url: '/api/roster', authorization: 'Bearer first', contentType: null },
      { url: '/api/roster', authorization: 'Bearer refreshed', contentType: 'application/json' },
    ]);
  });

  it('sends no token when nobody is signed in (the development sign-in)', async () => {
    const server = recording();
    await apiStore('/api', withToken(server.fetchFn, async () => null)).loadRoster();

    expect(server.seen[0]?.authorization).toBeNull();
  });
});
