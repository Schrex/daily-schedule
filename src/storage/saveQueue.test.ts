import { describe, expect, it } from 'vitest';
import { handle } from '../../worker/src/app';
import { localD1 } from '../../worker/src/testing/localD1';
import { onStandingRow, placeCrewMember, type DailySchedule, type Roster } from '../schedule-rules';
import { apiStore } from './apiStore';
import { openDate, openStore } from './index';
import { savedInOrder, type SaveState, type Saves } from './saveQueue';

const EDITOR = 'editor@example.test';
const d1 = localD1({ [EDITOR]: 'editor' });

const roster: Roster = {
  crewMembers: [{ id: 'ann', name: 'Ann', color: 'blue', foreman: false }],
  jobs: [{ id: 'cobblestone', name: 'Cobblestone' }],
};
const scheduleFor = (date: string): DailySchedule => ({ date, placements: [], tasks: {}, sends: [] });
const tuesday = scheduleFor('2026-11-10');
const annInShop = placeCrewMember(tuesday, 'ann', onStandingRow('shop'));
const annOffWork = placeCrewMember(tuesday, 'ann', onStandingRow('off-work'));

/**
 * The API-backed store through the Worker to a real local D1, behind a network
 * the test controls: it records each save that reaches the Worker, can hold
 * saves until let through, and can be down.
 */
function network() {
  const saves: { path: string; body: unknown }[] = [];
  const held: (() => void)[] = [];
  const net = {
    down: false,
    holding: false,
    /** Saves are answered with this status (401, 403, 400) instead of reaching the Worker. */
    refusing: null as number | null,
    saves,
    letThrough: () => held.splice(0).forEach((go) => go()),
  };
  const store = apiStore('http://localhost:8787/daily-schedule/api', async (input, init) => {
    if (init?.method === 'PUT') {
      if (net.holding) await new Promise<void>((go) => held.push(go));
      if (net.down) throw new TypeError('Failed to fetch');
      if (net.refusing !== null) return Response.json({ error: 'Refused' }, { status: net.refusing });
      saves.push({ path: new URL(input).pathname.replace('/daily-schedule/api', ''), body: JSON.parse(String(init.body)) });
    }
    return handle(new Request(input, init), d1.env({ DEV_AUTH_EMAIL: EDITOR }));
  });
  return Object.assign(net, { store });
}

/** A clock for the back-off: each wait stays pending until the test moves time on. */
function manualClock() {
  const asked: number[] = [];
  const pending: (() => void)[] = [];
  return {
    wait: (ms: number) =>
      new Promise<void>((done) => {
        asked.push(ms);
        pending.push(done);
      }),
    /** The waits asked for so far, in milliseconds. */
    asked,
    /** Ends the oldest wait still pending. */
    next: () => pending.shift()?.(),
  };
}

/** Lets every promise that can settle, settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

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

/** Whether a promise has settled by the time everything that can settle has. */
const settles = async (promise: Promise<unknown>) => {
  let settled = false;
  void promise.then(
    () => (settled = true),
    () => (settled = true),
  );
  await settle();
  return settled;
};

describe('saving in order', () => {
  it('sends saves one at a time in order, and only the latest waiting save for a date', async () => {
    const net = network();
    const { store, saves } = savedInOrder(net.store);

    net.holding = true;
    void store.saveRoster(roster);
    await settle();
    void store.saveSchedule(tuesday);
    void store.saveSchedule(annInShop);
    void store.saveRoster({ ...roster, jobs: [] });
    void store.saveSchedule(annOffWork);
    net.holding = false;
    net.letThrough();
    await allSaved(saves);

    expect(net.saves).toEqual([
      { path: '/roster', body: roster },
      { path: '/schedules/2026-11-10', body: annOffWork },
      { path: '/roster', body: { ...roster, jobs: [] } },
    ]);
    expect(await net.store.loadSchedule('2026-11-10')).toEqual(annOffWork);
  });
});

describe('a failed save', () => {
  it('reports not saved, retries with back-off, and reports all saved once it gets through', async () => {
    const net = network();
    const clock = manualClock();
    const { store, saves } = savedInOrder(net.store, { wait: clock.wait });
    const seen: SaveState[] = [];
    saves.subscribe(() => seen.push(saves.state()));
    expect(saves.state()).toBe('saved');

    net.down = true;
    void store.saveSchedule(annInShop);
    await settle();
    expect(saves.state()).toBe('not-saved');

    clock.next();
    await settle();
    expect(saves.state()).toBe('not-saved');

    net.down = false;
    clock.next();
    await allSaved(saves);

    expect(clock.asked).toEqual([1000, 2000]);
    expect(saves.state()).toBe('saved');
    expect(seen).toEqual(['saving', 'not-saved', 'saved']);
    expect(await net.store.loadSchedule('2026-11-10')).toEqual(annInShop);
  });

  it('sends only the latest change made while it was failing', async () => {
    const net = network();
    const clock = manualClock();
    const { store, saves } = savedInOrder(net.store, { wait: clock.wait });

    net.down = true;
    void store.saveSchedule(tuesday);
    await settle();
    void store.saveSchedule(annInShop);
    void store.saveSchedule(annOffWork);
    net.down = false;
    clock.next();
    await allSaved(saves);

    expect(net.saves).toEqual([{ path: '/schedules/2026-11-10', body: annOffWork }]);
    expect(saves.state()).toBe('saved');
  });

  it('still gives back a change that is waiting to be saved, so opening its date again keeps it', async () => {
    const net = network();
    const clock = manualClock();
    const { store } = savedInOrder(net.store, { wait: clock.wait });

    net.down = true;
    void store.saveRoster(roster);
    void store.saveSchedule(annInShop);
    await settle();

    expect(await store.loadSchedule('2026-11-10')).toEqual(annInShop);
    expect(await store.loadRoster()).toEqual(roster);
    expect(await store.listScheduleDates()).toEqual(['2026-11-10']);
  });
});

describe('a save the server refuses', () => {
  it.each([
    [401, 'sign-in-again'],
    [403, 'no-access'],
    [400, 'refused'],
  ] as const)('stops trying again on %i and says so (%s)', async (status, state) => {
    const net = network();
    const clock = manualClock();
    const { store, saves } = savedInOrder(net.store, { wait: clock.wait });

    net.refusing = status;
    void store.saveSchedule(annInShop);
    void store.saveRoster(roster);
    await settle();

    expect(saves.state()).toBe(state);
    expect(clock.asked).toEqual([]);
    // Nothing is lost from the page: the change is still given back.
    expect(await store.loadSchedule('2026-11-10')).toEqual(annInShop);

    void store.saveSchedule(annOffWork);
    await settle();
    expect(saves.state()).toBe(state);
    expect(net.saves).toEqual([]);
  });
});

describe('opening while saves are failing', () => {
  it('a save is done once it is queued, so nothing waits on the server taking it', async () => {
    const net = network();
    const { store, saves } = savedInOrder(net.store, { wait: manualClock().wait });

    net.down = true;
    expect(await settles(store.saveSchedule(annInShop))).toBe(true);
    expect(saves.state()).toBe('not-saved');
  });

  it('still opens a working day that has to be created and saved', async () => {
    const net = network();
    const { store, saves } = savedInOrder(net.store, { wait: manualClock().wait });

    net.down = true;
    const opening = openStore(store, { roster, schedule: tuesday }, '2026-11-09');
    expect(await settles(opening)).toBe(true);
    expect((await opening).schedule.date).toBe('2026-11-10');
    expect(await settles(openDate(store, roster, '2026-11-11'))).toBe(true);
    expect(saves.state()).toBe('not-saved');
  });
});
