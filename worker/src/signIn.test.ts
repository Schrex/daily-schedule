import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { handle } from './app';
import { emailFromToken, forgetHubKeys, hubKeys } from './signIn';
import { base64url, hubTokens, TEST_ISSUER, type TokenMaker } from './testing/hubTokens';
import { localD1 } from './testing/localD1';

const HUB = 'https://app.schreiberexcavating.com/daily-schedule/api';

const EDITOR = 'editor@example.test';
const VIEWER = 'viewer@example.test';
const STRANGER = 'stranger@example.test';

const d1 = localD1({ [EDITOR]: 'editor', [VIEWER]: 'viewer' });

let hub: TokenMaker;
beforeAll(async () => {
  hub = await hubTokens();
});

/** The Worker's environment as deployed: the hub's sign-in, with the tests' own public key. */
const env = () => d1.env({ HUB_AUTH_URL: TEST_ISSUER, HUB_JWKS: JSON.stringify(hub.jwks) });

/** Calls the Worker on the hub's address, with `token` (if any) as the sign-in. */
const call = (token: string | undefined, path: string, init: RequestInit = {}) =>
  handle(
    new Request(HUB + path, {
      ...init,
      headers: { ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }), ...init.headers },
    }),
    env(),
  );

describe('the hub sign-in', () => {
  it('tells an editor and a viewer who they are', async () => {
    const editor = await call(await hub.token(EDITOR), '/me');
    const viewer = await call(await hub.token(VIEWER), '/me');

    expect(editor.status).toBe(200);
    expect(await editor.json()).toEqual({ email: EDITOR, role: 'editor' });
    expect(await viewer.json()).toEqual({ email: VIEWER, role: 'viewer' });
  });

  it('lets an editor save with the token, and a viewer read it back', async () => {
    const roster = { crewMembers: [], jobs: [{ id: 'cobblestone', name: 'Cobblestone' }] };
    const saved = await call(await hub.token(EDITOR), '/roster', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roster),
    });

    expect(saved.ok).toBe(true);
    expect(await (await call(await hub.token(VIEWER), '/roster')).json()).toEqual(roster);
  });

  it('answers 403 to someone signed in to the hub but not on the list', async () => {
    const response = await call(await hub.token(STRANGER), '/me');

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  });

  it.each<[string, () => Promise<string | undefined>]>([
    ['no token', async () => undefined],
    ['a token that is not a token', async () => 'nonsense'],
    ['an expired token', () => hub.token(EDITOR, { exp: Math.floor(Date.now() / 1000) - 60 })],
    ['a token with no expiry', () => hub.token(EDITOR, { exp: undefined })],
    ['a token from another issuer', () => hub.token(EDITOR, { iss: 'https://elsewhere.example.test/auth/v1' })],
    ['an anonymous (not signed-in) token', () => hub.token(EDITOR, { aud: 'anon', role: 'anon' })],
    ['a token signed with a key the hub does not have', () => hub.token(EDITOR, {}, { kid: 'unknown-key' })],
    ['a token signed by someone else with the hub\'s key name', async () => (await hubTokens()).token(EDITOR)],
    ['a token that says HS256', () => hub.token(EDITOR, {}, { alg: 'HS256' })],
    [
      'a token whose email was changed after signing',
      async () => {
        const [head, , signature] = (await hub.token(VIEWER)).split('.');
        const body = base64url(
          JSON.stringify({ iss: TEST_ISSUER, aud: 'authenticated', email: EDITOR, exp: Date.now() / 1000 + 3600 }),
        );
        return `${head}.${body}.${signature}`;
      },
    ],
  ])('answers 401 for %s', async (_what, token) => {
    const response = await call(await token(), '/me');

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  });

  it('answers 401 when the Worker has no hub sign-in configured', async () => {
    const response = await handle(
      new Request(`${HUB}/me`, { headers: { Authorization: `Bearer ${await hub.token(EDITOR)}` } }),
      d1.env(),
    );

    expect(response.status).toBe(401);
  });
});

describe('the hub\'s keys', () => {
  const AUTH = 'https://keys.example.test/auth/v1';

  /** A fetch that answers with the hub's keys and counts the calls. */
  const keysServer = (jwks: () => { keys: JsonWebKey[] }) => {
    const calls: string[] = [];
    const fetchFn = async (url: string) => {
      calls.push(url);
      return Response.json(jwks());
    };
    return { calls, fetchFn };
  };

  beforeEach(() => forgetHubKeys());

  it('are fetched from the hub once, then kept', async () => {
    const server = keysServer(() => hub.jwks);
    const token = await hub.token(EDITOR, { iss: AUTH });

    expect(await emailFromToken(token, hubKeys(AUTH, server.fetchFn), AUTH)).toBe(EDITOR);
    expect(await emailFromToken(token, hubKeys(AUTH, server.fetchFn), AUTH)).toBe(EDITOR);
    expect(server.calls).toEqual([`${AUTH}/.well-known/jwks.json`]);
  });

  it('are fetched again when a token names a new key, but not more than once a minute', async () => {
    const rotated = await hubTokens('new-key');
    let published = hub.jwks;
    const server = keysServer(() => published);
    let now = 1_000_000;
    const keys = hubKeys(AUTH, server.fetchFn, () => now);
    await keys();

    expect(await emailFromToken(await rotated.token(EDITOR, { iss: AUTH }), keys, AUTH)).toBeNull();
    published = rotated.jwks;
    now += 30_000;
    expect(await emailFromToken(await rotated.token(EDITOR, { iss: AUTH }), keys, AUTH)).toBeNull();
    now += 61_000;
    expect(await emailFromToken(await rotated.token(EDITOR, { iss: AUTH }), keys, AUTH)).toBe(EDITOR);
    expect(server.calls).toHaveLength(2);
  });

  it('are fetched again after an hour', async () => {
    const server = keysServer(() => hub.jwks);
    let now = 1_000_000;
    const keys = hubKeys(AUTH, server.fetchFn, () => now);
    await keys();
    now += 61 * 60 * 1000;
    await keys();

    expect(server.calls).toHaveLength(2);
  });

  it('keep working from the kept copy when the hub cannot be reached', async () => {
    let up = true;
    const calls: string[] = [];
    const fetchFn = async (url: string) => {
      calls.push(url);
      if (!up) throw new Error('offline');
      return Response.json(hub.jwks);
    };
    let now = 1_000_000;
    const keys = hubKeys(AUTH, fetchFn, () => now);
    await keys();
    up = false;
    now += 61 * 60 * 1000;

    expect(await emailFromToken(await hub.token(EDITOR, { iss: AUTH }), keys, AUTH)).toBe(EDITOR);
  });
});
