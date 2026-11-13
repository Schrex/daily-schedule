import { describe, expect, it } from 'vitest';
import { addDayNote, crewView, markSent, onJob, placeCrewMember, type DailySchedule, type Roster } from '../../src/schedule-rules';
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

const roster: Roster = {
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

    expect(await (await call(EDITOR, '/schedules')).json()).toEqual(['2026-11-12', '2026-11-13']);
    expect(await (await call(EDITOR, '/schedules/2026-11-12')).json()).toEqual(thursday);
    expect(await (await call(EDITOR, '/schedules/2026-11-16')).json()).toBeNull();
  });

  it('never gives a Viewer the saved Daily Schedules or their dates: only what the Crew Page shows', async () => {
    await call(EDITOR, '/schedules/2026-11-12', put(scheduleFor('2026-11-12')));

    expect((await call(VIEWER, '/schedules')).status).toBe(403);
    expect((await call(VIEWER, '/schedules/2026-11-12')).status).toBe(403);
    expect((await call(VIEWER, '/crew-page')).status).toBe(200);
  });

  it('replaces a saved Daily Schedule with the newer save', async () => {
    await call(EDITOR, '/schedules/2026-11-13', put(scheduleFor('2026-11-13')));
    const changed = { ...scheduleFor('2026-11-13'), dayNotes: ['Rain day'] };
    await call(EDITOR, '/schedules/2026-11-13', put(changed));

    expect(await (await call(EDITOR, '/schedules/2026-11-13')).json()).toEqual(changed);
  });
});

describe('the API: what the Crew Page shows', () => {
  /** A Daily Schedule with Ann on Cobblestone, Sent as it stands at `sentAt`. */
  const sent = (date: string, sentAt: string): DailySchedule => {
    const placed = placeCrewMember({ date, placements: [], tasks: {}, sends: [] }, 'ann', onJob('cobblestone'));
    return markSent(placed, crewView(roster, placed), sentAt);
  };
  const annOnCobblestone = (date: string) => ({
    date,
    updated: false,
    rows: [
      {
        key: 'job:cobblestone',
        label: 'Cobblestone',
        destination: { kind: 'job', jobId: 'cobblestone' },
        tasks: [],
        who: [{ crewMember: roster.crewMembers[0] }],
      },
    ],
  });

  it('says nothing has been Sent when nothing has, whatever is saved', async () => {
    await call(EDITOR, '/roster', put(roster));
    await call(EDITOR, '/schedules/2026-11-13', put(addDayNote(scheduleFor('2026-11-13'), 'Not sent yet')));

    const response = await call(VIEWER, '/crew-page');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ jobs: roster.jobs, sent: null, previous: null });
  });

  it('gives a Viewer the newest Sent Daily Schedule and the one before it, each as the crew got it', async () => {
    await call(EDITOR, '/roster', put(roster));
    await call(EDITOR, '/schedules/2026-11-10', put(sent('2026-11-10', '2026-11-09T22:00:00.000Z')));
    await call(EDITOR, '/schedules/2026-11-11', put(sent('2026-11-11', '2026-11-10T22:00:00.000Z')));
    await call(EDITOR, '/schedules/2026-11-12', put(sent('2026-11-12', '2026-11-11T22:00:00.000Z')));

    expect(await (await call(VIEWER, '/crew-page')).json()).toEqual({
      jobs: roster.jobs,
      sent: { view: annOnCobblestone('2026-11-12'), sentAt: '2026-11-11T22:00:00.000Z', sentAgain: false },
      previous: { view: annOnCobblestone('2026-11-11'), sentAt: '2026-11-10T22:00:00.000Z', sentAgain: false },
    });
  });

  it('has nothing in it that was not Sent: no Daily Schedule never Sent, and no change made since a Send', async () => {
    await call(EDITOR, '/roster', put(roster));
    const thursday = sent('2026-11-12', '2026-11-11T22:00:00.000Z');
    await call(EDITOR, '/schedules/2026-11-12', put(addDayNote(thursday, 'Changed since the Send')));
    await call(EDITOR, '/schedules/2026-11-13', put(addDayNote(scheduleFor('2026-11-13'), 'Never sent')));

    const response = await call(VIEWER, '/crew-page');
    const answer = await response.text();

    expect(JSON.parse(answer)).toEqual({
      jobs: roster.jobs,
      sent: { view: annOnCobblestone('2026-11-12'), sentAt: '2026-11-11T22:00:00.000Z', sentAgain: false },
      previous: null,
    });
    expect(answer).not.toContain('Changed since the Send');
    expect(answer).not.toContain('Never sent');
    expect(answer).not.toContain('2026-11-13');
  });

  it('is read-only, and for someone signed in only', async () => {
    expect((await call(undefined, '/crew-page')).status).toBe(401);
    expect((await call(EDITOR, '/crew-page', put({}))).ok).toBe(false);
    expect((await call(VIEWER, '/crew-page', { method: 'POST' })).ok).toBe(false);
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

  it('treats someone signed in but not on the list as a viewer: they read what a Viewer may, and save nothing', async () => {
    await call(EDITOR, '/roster', put(roster));

    expect(await (await call(STRANGER, '/me')).json()).toEqual({ email: STRANGER, role: 'viewer' });
    expect(await (await call(STRANGER, '/roster')).json()).toEqual(roster);
    expect((await call(STRANGER, '/crew-page')).status).toBe(200);
    expect((await call(STRANGER, '/schedules')).status).toBe(403);

    const response = await call(STRANGER, '/roster', put({ ...roster, jobs: [] }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: expect.any(String) });
    expect(await (await call(EDITOR, '/roster')).json()).toEqual(roster);
  });

  it('has no import any more: an Export file upload is refused for everyone, changing nothing', async () => {
    await call(EDITOR, '/roster', put(roster));
    const file = { kind: 'daily-schedule-export', version: 1, roster: { ...roster, jobs: [] }, schedules: [] };

    for (const email of [EDITOR, STRANGER]) {
      const response = await call(email, '/import', { method: 'POST', body: JSON.stringify(file) });
      expect(response.ok).toBe(false);
    }
    expect(await (await call(EDITOR, '/roster')).json()).toEqual(roster);
  });

  it('answers 403 to a viewer\'s save, saving nothing', async () => {
    expect((await call(VIEWER, '/roster', put(roster))).status).toBe(403);
    expect((await call(VIEWER, '/schedules/2026-11-13', put(scheduleFor('2026-11-13')))).status).toBe(403);

    expect(await (await call(EDITOR, '/roster')).json()).toBeNull();
    expect(await (await call(EDITOR, '/schedules')).json()).toEqual([]);
  });

  it.each(['https://app.schreiberexcavating.com'])(
    'refuses to answer on %s when the development sign-in is set, saving nothing',
    async (origin) => {
      const response = await call(EDITOR, '/roster', put(roster), `${origin}/daily-schedule/api`);

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: expect.any(String) });
      expect(await (await call(EDITOR, '/roster')).json()).toBeNull();
    },
  );

  it.each(['https://app.schreiberexcavating.com/daily-schedule/'])(
    'serves no page on %s either when the development sign-in is set',
    async (url) => {
      const response = await handle(new Request(url), d1.env({ DEV_AUTH_EMAIL: EDITOR }));

      expect(response.status).toBe(500);
    },
  );
});
