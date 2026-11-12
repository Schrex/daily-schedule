import { describe, expect, it } from 'vitest';
import { handle } from './app';
import { localD1 } from './testing/localD1';

const LOCAL = 'http://localhost:8787/daily-schedule/api';

const EDITOR = 'editor@example.test';
const VIEWER = 'viewer@example.test';
const STRANGER = 'stranger@example.test';

const d1 = localD1({ [EDITOR]: 'editor', [VIEWER]: 'viewer' });

/** Calls the Worker as `email` through the development sign-in (or signed out). */
const call = (email: string | undefined, path: string, init?: RequestInit, base = LOCAL) =>
  handle(new Request(base + path, init), d1.env(email === undefined ? {} : { DEV_AUTH_EMAIL: email }));

const roster = {
  crewMembers: [{ id: 'ann', name: 'Ann', color: 'blue', foreman: false }],
  jobs: [{ id: 'cobblestone', name: 'Cobblestone' }],
};

const scheduleFor = (date: string) => ({ date, placements: [], tasks: {}, sends: [] });

const put = (body: unknown): RequestInit => ({
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

describe('the API: the Roster and the Daily Schedules', () => {
  it('gives null for the Roster before one is saved', async () => {
    const response = await call(EDITOR, '/roster');

    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  it('keeps the Roster an editor saves, for anyone on the list to read', async () => {
    expect((await call(EDITOR, '/roster', put(roster))).ok).toBe(true);

    expect(await (await call(EDITOR, '/roster')).json()).toEqual(roster);
    expect(await (await call(VIEWER, '/roster')).json()).toEqual(roster);
  });

  it('keeps each Daily Schedule under its own date and lists the dates earliest first', async () => {
    const thursday = { ...scheduleFor('2026-11-12'), dayNotes: ['Bring the pump'] };
    await call(EDITOR, '/schedules/2026-11-13', put(scheduleFor('2026-11-13')));
    await call(EDITOR, '/schedules/2026-11-12', put(thursday));

    expect(await (await call(VIEWER, '/schedules')).json()).toEqual(['2026-11-12', '2026-11-13']);
    expect(await (await call(VIEWER, '/schedules/2026-11-12')).json()).toEqual(thursday);
    expect(await (await call(VIEWER, '/schedules/2026-11-16')).json()).toBeNull();
  });

  it('replaces a saved Daily Schedule with the newer save', async () => {
    await call(EDITOR, '/schedules/2026-11-13', put(scheduleFor('2026-11-13')));
    const changed = { ...scheduleFor('2026-11-13'), dayNotes: ['Rain day'] };
    await call(EDITOR, '/schedules/2026-11-13', put(changed));

    expect(await (await call(EDITOR, '/schedules/2026-11-13')).json()).toEqual(changed);
  });
});

describe('the API: refusing bad saves', () => {
  it.each([
    ['not JSON', '{nope'],
    ['not a Roster', { crewMembers: 'Ann' }],
  ])('answers 400 for a Roster that is %s, and keeps the saved one', async (_what, body) => {
    await call(EDITOR, '/roster', put(roster));
    const response = await call(EDITOR, '/roster', put(body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
    expect(await (await call(EDITOR, '/roster')).json()).toEqual(roster);
  });

  it('answers 400 for a Daily Schedule whose date is not the one in the path, saving nothing', async () => {
    const response = await call(EDITOR, '/schedules/2026-11-13', put(scheduleFor('2026-11-16')));

    expect(response.status).toBe(400);
    expect(await (await call(EDITOR, '/schedules')).json()).toEqual([]);
  });

  it('answers 400 for a malformed Daily Schedule or date', async () => {
    expect((await call(EDITOR, '/schedules/2026-11-13', put({ date: '2026-11-13' }))).status).toBe(400);
    expect((await call(EDITOR, '/schedules/tomorrow')).status).toBe(400);
    expect(await (await call(EDITOR, '/schedules')).json()).toEqual([]);
  });
});

describe('the API: who may call it', () => {
  it('answers 401 without a sign-in', async () => {
    const response = await call(undefined, '/roster');

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  });

  it('treats someone signed in but not on the list as a viewer: they read, and save nothing', async () => {
    await call(EDITOR, '/roster', put(roster));

    expect(await (await call(STRANGER, '/me')).json()).toEqual({ email: STRANGER, role: 'viewer' });
    expect(await (await call(STRANGER, '/roster')).json()).toEqual(roster);
    expect((await call(STRANGER, '/schedules')).status).toBe(200);

    const response = await call(STRANGER, '/roster', put({ ...roster, jobs: [] }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: expect.any(String) });
    expect(
      (await call(STRANGER, '/import', { method: 'POST', body: '{}' })).status,
    ).toBe(403);
    expect(await (await call(EDITOR, '/roster')).json()).toEqual(roster);
  });

  it('answers 403 to a viewer\'s save, saving nothing', async () => {
    expect((await call(VIEWER, '/roster', put(roster))).status).toBe(403);
    expect((await call(VIEWER, '/schedules/2026-11-13', put(scheduleFor('2026-11-13')))).status).toBe(403);

    expect(await (await call(EDITOR, '/roster')).json()).toBeNull();
    expect(await (await call(EDITOR, '/schedules')).json()).toEqual([]);
  });

  it.each(['https://app.schreiberexcavating.com', 'https://daily-schedule.schrex.workers.dev'])(
    'refuses to answer on %s when the development sign-in is set, saving nothing',
    async (origin) => {
      const response = await call(EDITOR, '/roster', put(roster), `${origin}/daily-schedule/api`);

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: expect.any(String) });
      expect(await (await call(EDITOR, '/roster')).json()).toBeNull();
    },
  );

  it.each(['https://app.schreiberexcavating.com/daily-schedule/', 'https://daily-schedule.schrex.workers.dev/'])(
    'serves no page on %s either when the development sign-in is set',
    async (url) => {
      const response = await handle(new Request(url), d1.env({ DEV_AUTH_EMAIL: EDITOR }));

      expect(response.status).toBe(500);
    },
  );
});
