import { describe, expect, it } from 'vitest';
import { handle } from '../../worker/src/app';
import { localD1 } from '../../worker/src/testing/localD1';
import { markSent, type DailySchedule, type Roster } from '../schedule-rules';
import { loadSlackSettings, saveSlackSettings, type SlackSettings } from '../send/slackSettings';
import { apiStore } from '../storage/apiStore';
import { memoryStore } from '../storage/memoryStore';
import { openStore } from '../storage';
import { exportFrom, uploadExportFile } from './index';

const EDITOR = 'editor@example.test';
const VIEWER = 'viewer@example.test';
const d1 = localD1({ [EDITOR]: 'editor', [VIEWER]: 'viewer' });

const API = 'http://localhost:8787/daily-schedule/api';

/** Calls the Worker as `email` through the development sign-in. */
const asCaller = (email: string) => (input: string, init?: RequestInit) =>
  handle(new Request(input, init), d1.env({ DEV_AUTH_EMAIL: email }));

/** Browser storage for one address, in memory. */
function fakeStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    key: (index) => [...items.keys()][index] ?? null,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, String(value)),
    removeItem: (key) => void items.delete(key),
    clear: () => items.clear(),
  };
}

const oldRoster: Roster = {
  crewMembers: [
    { id: 'ann', name: 'Ann', color: 'blue', foreman: true },
    { id: 'bob', name: 'Bob', color: 'orange', foreman: false },
  ],
  jobs: [{ id: 'cobblestone', name: 'Cobblestone' }],
};

const oldSchedules: DailySchedule[] = [
  {
    date: '2026-11-05',
    placements: [{ crewMemberId: 'ann', destination: { kind: 'job', jobId: 'cobblestone' }, order: 1 }],
    tasks: { cobblestone: ['Strip topsoil'] },
    sends: [{ sentAt: '2026-11-04T22:00:00.000Z', sent: { date: '2026-11-05', jobs: [], standingRows: [] } as never }],
  },
  { date: '2026-11-06', placements: [], tasks: {}, sends: [], dayNotes: ['Rain day'] },
];

const slack: SlackSettings = {
  relayUrl: 'https://daily-schedule-slack.example.workers.dev',
  sendKey: 'a-send-key',
  channel: 'C0CHSMJFFPS',
};

/** The starter Roster and Daily Schedule the new address makes on first open. */
const starter = {
  roster: { crewMembers: [{ id: 'zed', name: 'Zed', color: 'red', foreman: false }], jobs: [] } as Roster,
  schedule: { date: '2026-11-10', placements: [], tasks: {}, sends: [] } as DailySchedule,
};

/** The old address's saved schedules, as an export file. */
async function oldExportFile(): Promise<string> {
  const old = memoryStore();
  await old.saveRoster(oldRoster);
  for (const schedule of oldSchedules) await old.saveSchedule(schedule);
  return JSON.stringify(await exportFrom(old, slack));
}

describe('moving the data with an Export file', () => {
  it('carries the Roster, every Daily Schedule and the Slack settings to the new address, replacing the starters', async () => {
    const store = apiStore(API, asCaller(EDITOR));
    await openStore(store, starter, '2026-11-09');
    const newAddress = fakeStorage();

    const result = await uploadExportFile(await oldExportFile(), {
      base: API,
      fetch: asCaller(EDITOR),
      storage: newAddress,
    });

    expect(result).toEqual({ schedules: 2 });
    expect(await store.loadRoster()).toEqual(oldRoster);
    expect(await store.listScheduleDates()).toEqual(['2026-11-05', '2026-11-06']);
    expect(await store.loadSchedule('2026-11-05')).toEqual(oldSchedules[0]);
    expect(await store.loadSchedule('2026-11-06')).toEqual(oldSchedules[1]);
    expect(loadSlackSettings(newAddress)).toEqual(slack);
  });

  it('is refused once a Daily Schedule at the new address has a Send recorded, changing nothing', async () => {
    const store = apiStore(API, asCaller(EDITOR));
    const opened = await openStore(store, starter, '2026-11-09');
    const sent = markSent(opened.schedule, { date: opened.schedule.date } as never, '2026-11-09T22:00:00.000Z');
    await store.saveSchedule(sent);
    const newAddress = fakeStorage();
    const ownSlack = { relayUrl: 'https://relay.example', sendKey: 'k', channel: '' };
    saveSlackSettings(ownSlack, newAddress);

    await expect(
      uploadExportFile(await oldExportFile(), { base: API, fetch: asCaller(EDITOR), storage: newAddress }),
    ).rejects.toMatchObject({ status: 409 });

    expect(await store.loadRoster()).toEqual(starter.roster);
    expect(await store.loadSchedule(sent.date)).toEqual(sent);
    expect(loadSlackSettings(newAddress)).toEqual(ownSlack);
  });

  it('is refused for a viewer, changing nothing', async () => {
    const store = apiStore(API, asCaller(EDITOR));
    await openStore(store, starter, '2026-11-09');

    await expect(
      uploadExportFile(await oldExportFile(), { base: API, fetch: asCaller(VIEWER), storage: fakeStorage() }),
    ).rejects.toMatchObject({ status: 403 });

    expect(await store.loadRoster()).toEqual(starter.roster);
  });

  it('refuses a file that is not an Export file, before sending anything', async () => {
    const store = apiStore(API, asCaller(EDITOR));
    await openStore(store, starter, '2026-11-09');

    await expect(
      uploadExportFile('{"hello": 1}', { base: API, fetch: asCaller(EDITOR), storage: fakeStorage() }),
    ).rejects.toThrow(/not a Daily Schedule export file/i);

    expect(await store.loadRoster()).toEqual(starter.roster);
  });
});
