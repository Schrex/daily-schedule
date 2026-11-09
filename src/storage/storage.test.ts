import { describe, expect, it } from 'vitest';
import { onStandingRow, placeCrewMember, type DailySchedule, type Roster } from '../schedule-rules';
import { memoryStore } from './memoryStore';
import { openStore } from './index';

const roster: Roster = {
  crewMembers: [{ id: 'ann', name: 'Ann', color: 'blue', foreman: false }],
  jobs: [{ id: 'cobblestone', name: 'Cobblestone' }],
};

const scheduleFor = (date: string): DailySchedule => ({ date, placements: [], tasks: {}, sends: [] });

const seed = { roster, schedule: scheduleFor('2026-11-10') };

describe('opening the store', () => {
  it('loads the seed roster and seed Daily Schedule on first ever open', async () => {
    const opened = await openStore(memoryStore(), seed);

    expect(opened.roster).toEqual(seed.roster);
    expect(opened.schedule).toEqual(seed.schedule);
  });

  it('shows a saved change when opened again, instead of the seed', async () => {
    const store = memoryStore();
    const first = await openStore(store, seed);
    const changed = placeCrewMember(first.schedule, 'ann', onStandingRow('shop'));
    await store.saveSchedule(changed);

    const reopened = await openStore(store, seed);

    expect(reopened.schedule.placements).toEqual([
      { crewMemberId: 'ann', destination: { kind: 'standing-row', standingRow: 'shop' }, order: 1 },
    ]);
  });

  it('keeps a changed roster when opened again, instead of the seed roster', async () => {
    const store = memoryStore();
    await openStore(store, seed);
    await store.saveRoster({ ...roster, jobs: [] });

    const reopened = await openStore(store, seed);

    expect(reopened.roster.jobs).toEqual([]);
  });

  it('opens the Daily Schedule with the latest date', async () => {
    const store = memoryStore();
    await openStore(store, seed);
    await store.saveSchedule(scheduleFor('2026-11-12'));
    await store.saveSchedule(scheduleFor('2026-11-11'));

    const reopened = await openStore(store, seed);

    expect(reopened.schedule.date).toBe('2026-11-12');
  });

  it('keeps each Daily Schedule under its own date', async () => {
    const store = memoryStore();
    await openStore(store, seed);
    await store.saveSchedule(scheduleFor('2026-11-11'));

    expect(await store.listScheduleDates()).toEqual(['2026-11-10', '2026-11-11']);
    expect(await store.loadSchedule('2026-11-10')).toEqual(seed.schedule);
    expect(await store.loadSchedule('2026-11-13')).toBeNull();
  });
});
