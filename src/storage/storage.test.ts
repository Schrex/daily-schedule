import { beforeEach, describe, expect, it } from 'vitest';
import { handle } from '../../worker/src/app';
import { localD1 } from '../../worker/src/testing/localD1';
import { onStandingRow, placeCrewMember, type DailySchedule, type Roster } from '../schedule-rules';
import { apiStore } from './apiStore';
import { memoryStore } from './memoryStore';
import { savedInOrder } from './saveQueue';
import { openDate, openStore, type ScheduleStore } from './index';

const EDITOR = 'editor@example.test';
const d1 = localD1({ [EDITOR]: 'editor' });

/**
 * The same tests run against every store: the in-memory fake, and the store
 * the pages use, through the Worker's API to a real local D1 (signed in as an
 * editor with the development sign-in).
 */
const stores: [string, () => ScheduleStore][] = [
  ['the in-memory store', memoryStore],
  [
    'the API-backed store, through the Worker to D1',
    () =>
      apiStore('http://localhost:8787/daily-schedule/api', (input, init) =>
        handle(new Request(input, init), d1.env({ DEV_AUTH_EMAIL: EDITOR })),
      ),
  ],
  [
    'the API-backed store behind the save queue, as the pages use it',
    () =>
      savedInOrder(
        apiStore('http://localhost:8787/daily-schedule/api', (input, init) =>
          handle(new Request(input, init), d1.env({ DEV_AUTH_EMAIL: EDITOR })),
        ),
      ).store,
  ],
];

const roster: Roster = {
  crewMembers: [{ id: 'ann', name: 'Ann', color: 'blue', foreman: false }],
  jobs: [{ id: 'cobblestone', name: 'Cobblestone' }],
};

const scheduleFor = (date: string): DailySchedule => ({ date, placements: [], tasks: {}, sends: [] });

const seed = { roster, schedule: scheduleFor('2026-11-10') };

/** The evening before the seed Daily Schedule's date. */
const monday = '2026-11-09';

describe.each(stores)('%s', (_name, makeStore) => {
  let store: ScheduleStore;
  beforeEach(() => {
    store = makeStore();
  });

  describe('opening the store', () => {
    it('loads the seed roster and seed Daily Schedule on first ever open', async () => {
      const opened = await openStore(store, seed, monday);

      expect(opened.roster).toEqual(seed.roster);
      expect(opened.schedule).toEqual(seed.schedule);
    });

    it('shows a saved change when opened again, instead of the seed', async () => {
      const first = await openStore(store, seed, monday);
      const changed = placeCrewMember(first.schedule, 'ann', onStandingRow('shop'));
      await store.saveSchedule(changed);

      const reopened = await openStore(store, seed, monday);

      expect(reopened.schedule.placements).toEqual([
        { crewMemberId: 'ann', destination: { kind: 'standing-row', standingRow: 'shop' }, order: 1 },
      ]);
    });

    it('keeps a changed roster when opened again, instead of the seed roster', async () => {
      await openStore(store, seed, monday);
      await store.saveRoster({ ...roster, jobs: [] });

      const reopened = await openStore(store, seed, monday);

      expect(reopened.roster.jobs).toEqual([]);
    });

    it('opens the Daily Schedule for the next working day, not the latest saved one', async () => {
      await openStore(store, seed, monday);
      await store.saveSchedule(scheduleFor('2026-11-12'));
      await store.saveSchedule(scheduleFor('2026-11-11'));

      const reopened = await openStore(store, seed, '2026-11-10');

      expect(reopened.schedule.date).toBe('2026-11-11');
    });

    it('creates and saves the next Daily Schedule from the most recent earlier one', async () => {
      const first = await openStore(store, seed, monday);
      const tuesday = placeCrewMember(first.schedule, 'ann', onStandingRow('shop'));
      await store.saveSchedule(tuesday);

      // Friday evening opens Monday, copied from Tuesday.
      const reopened = await openStore(store, seed, '2026-11-13');

      expect(reopened.schedule).toEqual({ ...tuesday, date: '2026-11-16' });
      expect(await store.loadSchedule('2026-11-16')).toEqual(reopened.schedule);
      expect(await store.loadSchedule('2026-11-10')).toEqual(tuesday);
    });

    it('keeps each Daily Schedule under its own date', async () => {
      await openStore(store, seed, monday);
      await store.saveSchedule(scheduleFor('2026-11-11'));

      expect(await store.listScheduleDates()).toEqual(['2026-11-10', '2026-11-11']);
      expect(await store.loadSchedule('2026-11-10')).toEqual(seed.schedule);
      expect(await store.loadSchedule('2026-11-13')).toBeNull();
    });
  });

  describe('opening a date', () => {
    it('opens the Daily Schedule saved for that date, with its changes', async () => {
      const { schedule } = await openStore(store, seed, monday);
      const changed = placeCrewMember(schedule, 'ann', onStandingRow('shop'));
      await store.saveSchedule(changed);
      await openDate(store, roster, '2026-11-11');

      expect(await openDate(store, roster, '2026-11-10')).toEqual(changed);
      expect(await store.listScheduleDates()).toEqual(['2026-11-10', '2026-11-11']);
    });

    it('creates and saves a Daily Schedule for a date that has none, keeping the earlier ones', async () => {
      const { schedule } = await openStore(store, seed, monday);
      const tuesday = placeCrewMember(schedule, 'ann', onStandingRow('off-work'));
      await store.saveSchedule(tuesday);

      const saturday = await openDate(store, roster, '2026-11-14');

      expect(saturday).toEqual(scheduleFor('2026-11-14'));
      expect(await store.loadSchedule('2026-11-14')).toEqual(saturday);
      expect(await store.loadSchedule('2026-11-10')).toEqual(tuesday);
    });
  });
});

describe('the API-backed store', () => {
  it('fails a save the Worker refuses, with the Worker\'s reason', async () => {
    const notOnTheList = apiStore('http://localhost:8787/daily-schedule/api', (input, init) =>
      handle(new Request(input, init), d1.env({ DEV_AUTH_EMAIL: 'stranger@example.test' })),
    );

    await expect(notOnTheList.saveRoster(roster)).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('access'),
    });
  });
});
