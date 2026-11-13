import { describe, expect, it } from 'vitest';
import { handle } from '../../worker/src/app';
import { localD1 } from '../../worker/src/testing/localD1';
import {
  crewView,
  lastSentAt,
  markSent,
  onStandingRow,
  placeCrewMember,
  type DailySchedule,
  type Roster,
} from '../schedule-rules';
import { apiStore } from './apiStore';
import { reloadOnFocus, reloadsOnFocus } from './reloadOnFocus';
import { savedInOrder, type Saves } from './saveQueue';

/** Resolves once the queue reports everything saved. */
const allSaved = (saves: Saves) =>
  new Promise<void>((done) => {
    if (saves.state() === 'saved') return done();
    const stop = saves.subscribe(() => {
      if (saves.state() !== 'saved') return;
      stop();
      done();
    });
  });

const EDITOR = 'editor@example.test';
const d1 = localD1({ [EDITOR]: 'editor' });

const roster: Roster = {
  crewMembers: [{ id: 'ann', name: 'Ann', color: 'blue', foreman: false }],
  jobs: [{ id: 'cobblestone', name: 'Cobblestone' }],
};
const tuesday: DailySchedule = { date: '2026-11-10', placements: [], tasks: {}, sends: [] };
const annInShop = placeCrewMember(tuesday, 'ann', onStandingRow('shop'));

/**
 * Two devices on one database (the Worker over a real local D1): `office` is
 * the board left open on the computer, behind its save queue and a network
 * the test can hold; `phone` saves straight to the server.
 */
async function twoDevices() {
  const held: (() => void)[] = [];
  const net = {
    /** Holds the office's saves until let through. */
    holding: false,
    /** How many times the office asked the server for something. */
    loads: 0,
    letThrough: () => held.splice(0).forEach((go) => go()),
  };
  const worker = (input: string, init?: RequestInit) =>
    handle(new Request(input, init), d1.env({ DEV_AUTH_EMAIL: EDITOR }));
  const phone = apiStore('http://localhost:8787/daily-schedule/api', worker);
  const office = savedInOrder(
    apiStore('http://localhost:8787/daily-schedule/api', async (input, init) => {
      if (init?.method === 'PUT') {
        if (net.holding) await new Promise<void>((go) => held.push(go));
      } else net.loads += 1;
      return worker(input, init);
    }),
  );
  await phone.saveRoster(roster);
  await phone.saveSchedule(tuesday);
  return { phone, office, net };
}

describe('the board gets the focus with everything saved', () => {
  it('loads the Daily Schedule for the date on the screen as another device saved it', async () => {
    const { phone, office } = await twoDevices();
    await phone.saveSchedule(annInShop);

    const found = await reloadOnFocus(office.store, office.saves, { roster, schedule: tuesday });

    expect(found?.schedule).toEqual(annInShop);
  });

  it('loads the Roster as Settings on another device saved it, and keeps the Daily Schedule that is the same', async () => {
    const { phone, office } = await twoDevices();
    const withoutJobs: Roster = { ...roster, jobs: [] };
    await phone.saveRoster(withoutJobs);

    const found = await reloadOnFocus(office.store, office.saves, { roster, schedule: tuesday });

    expect(found?.roster).toEqual(withoutJobs);
    expect(found?.schedule).toBe(tuesday);
  });

  it('finds nothing to change when what is saved is what is on the screen', async () => {
    const { office, net } = await twoDevices();
    // The same Daily Schedule, built apart from the saved one and with its keys in another order.
    const onScreen = {
      roster: structuredClone(roster),
      schedule: { sends: [], tasks: {}, placements: [], date: '2026-11-10' },
    };

    expect(await reloadOnFocus(office.store, office.saves, onScreen)).toBeNull();
    expect(net.loads).toBe(2);
  });

  it('has the send record another Editor made, so "Last sent" is right', async () => {
    const { phone, office } = await twoDevices();
    const sent = markSent(tuesday, crewView(roster, tuesday), '2026-11-09T21:30:00.000Z');
    await phone.saveSchedule(sent);

    const found = await reloadOnFocus(office.store, office.saves, { roster, schedule: tuesday });

    expect(found && lastSentAt(found.schedule)).toBe('2026-11-09T21:30:00.000Z');
  });

  it('leaves the screen alone when the server has no Daily Schedule for its date', async () => {
    const { office } = await twoDevices();
    const wednesday: DailySchedule = { ...tuesday, date: '2026-11-11' };

    expect(await reloadOnFocus(office.store, office.saves, { roster, schedule: wednesday })).toBeNull();
    expect(await office.store.listScheduleDates()).toEqual(['2026-11-10']);
  });
});

describe('the board gets the focus while a change is not saved yet', () => {
  it('does not reload, and asks the server for nothing', async () => {
    const { phone, office, net } = await twoDevices();
    const annOffWork = placeCrewMember(tuesday, 'ann', onStandingRow('off-work'));
    await phone.saveSchedule(annInShop);
    net.holding = true;
    void office.store.saveSchedule(annOffWork);
    expect(office.saves.state()).toBe('saving');

    expect(await reloadOnFocus(office.store, office.saves, { roster, schedule: annOffWork })).toBeNull();
    expect(net.loads).toBe(0);

    // Once it is saved, the next focus reloads again (and finds the board's own change).
    net.holding = false;
    net.letThrough();
    await allSaved(office.saves);
    expect(await reloadOnFocus(office.store, office.saves, { roster, schedule: tuesday })).toEqual({
      roster,
      schedule: annOffWork,
    });
  });

  it('drops what it loaded when a change was made while the load was on its way', async () => {
    const { phone, office, net } = await twoDevices();
    await phone.saveSchedule(annInShop);

    const reloading = reloadOnFocus(office.store, office.saves, { roster, schedule: tuesday });
    net.holding = true;
    void office.store.saveRoster({ ...roster, jobs: [] });

    expect(await reloading).toBeNull();
    net.holding = false;
    net.letThrough();
    await allSaved(office.saves);
  });
});

describe('when a focus reloads', () => {
  it.each([
    ['saved', true],
    ['saving', false],
    ['not-saved', false],
    ['sign-in-again', false],
    ['no-access', false],
    ['refused', false],
  ] as const)('with the saves %s: %s', (state, reloads) => {
    expect(reloadsOnFocus(state)).toBe(reloads);
  });
});
