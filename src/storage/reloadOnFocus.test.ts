import { describe, expect, it } from 'vitest';
import { handle } from '../../worker/src/app';
import { localD1 } from '../../worker/src/testing/localD1';
import {
  addDayNote,
  applyEdit,
  crewView,
  lastSentAt,
  markSent,
  onStandingRow,
  placeCrewMember,
  type DailySchedule,
  type Roster,
  type ScheduleEdit,
} from '../schedule-rules';
import { apiStore } from './apiStore';
import type { Opened } from './index';
import { boardReloads, reloadOnFocus, reloadsOnFocus, type Board } from './reloadOnFocus';
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
    /** Holds what the office asks the server for until let through. */
    holdingLoads: false,
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
      } else {
        net.loads += 1;
        if (net.holdingLoads) await new Promise<void>((go) => held.push(go));
      }
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

/**
 * The board as the page holds it, without the page: what is on the screen,
 * whether a text field has the focus, and the Scheduler's edits applied and
 * saved as the page does.
 */
function boardOn(office: Awaited<ReturnType<typeof twoDevices>>['office'], opened: Opened) {
  const state = { onScreen: opened, typing: false };
  const board: Board = {
    onScreen: () => state.onScreen,
    typing: () => state.typing,
    show: (found) => {
      state.onScreen = found;
    },
    edit: (edit) => {
      const schedule = applyEdit(state.onScreen.schedule, edit, state.onScreen.roster);
      state.onScreen = { ...state.onScreen, schedule };
      void office.store.saveSchedule(schedule);
    },
  };
  return { state, board, reloads: boardReloads(office.store, office.saves, board) };
}

const bringThePump: ScheduleEdit = { kind: 'add-day-note', text: 'Bring the pump' };

describe('the Scheduler edits the board while a reload is on its way', () => {
  it('holds the edit, and applies it on top of what the reload found', async () => {
    const { phone, office, net } = await twoDevices();
    await phone.saveSchedule(annInShop);
    const { state, reloads } = boardOn(office, { roster, schedule: tuesday });

    net.holdingLoads = true;
    reloads.focus();
    expect(reloads.hold(bringThePump)).toBe(true);
    expect(state.onScreen.schedule).toBe(tuesday);

    net.holdingLoads = false;
    net.letThrough();
    await reloads.settled();
    await allSaved(office.saves);

    const both = addDayNote(annInShop, 'Bring the pump');
    expect(state.onScreen.schedule).toEqual(both);
    expect(await phone.loadSchedule('2026-11-10')).toEqual(both);
  });

  it('makes a Send wait: it is settled only once the reload has answered and the held edits are on the board', async () => {
    const { phone, office, net } = await twoDevices();
    await phone.saveSchedule(annInShop);
    const { state, reloads } = boardOn(office, { roster, schedule: tuesday });

    net.holdingLoads = true;
    reloads.focus();
    reloads.hold(bringThePump);
    let onTheBoardWhenSettled: DailySchedule | undefined;
    const settled = reloads.settled().then(() => {
      onTheBoardWhenSettled = state.onScreen.schedule;
    });
    await new Promise((later) => setTimeout(later, 20));
    expect(onTheBoardWhenSettled).toBeUndefined();

    net.holdingLoads = false;
    net.letThrough();
    await settled;
    expect(onTheBoardWhenSettled).toEqual(addDayNote(annInShop, 'Bring the pump'));
    await allSaved(office.saves);
  });

  it('holds nothing when no reload is on its way', async () => {
    const { office } = await twoDevices();
    const { reloads } = boardOn(office, { roster, schedule: tuesday });

    expect(reloads.hold(bringThePump)).toBe(false);
    reloads.focus();
    await reloads.settled();
    expect(reloads.hold(bringThePump)).toBe(false);
  });

  it('still applies the held edit when the reload fails', async () => {
    const { office } = await twoDevices();
    const state = { onScreen: { roster, schedule: tuesday } };
    const down = { ...office.store, loadRoster: () => Promise.reject(new Error('The server is away.')) };
    const reloads = boardReloads(down, office.saves, {
      onScreen: () => state.onScreen,
      typing: () => false,
      show: () => {},
      edit: (edit) => {
        state.onScreen = { roster, schedule: applyEdit(state.onScreen.schedule, edit, roster) };
      },
    });

    reloads.focus();
    expect(reloads.hold(bringThePump)).toBe(true);
    await reloads.settled();

    expect(state.onScreen.schedule).toEqual(addDayNote(tuesday, 'Bring the pump'));
  });
});

describe('the board gets the focus while a text field on it has the focus', () => {
  it('does not reload, and asks the server for nothing: the text being typed stays where it is', async () => {
    const { phone, office, net } = await twoDevices();
    await phone.saveSchedule(annInShop);
    const { state, reloads } = boardOn(office, { roster, schedule: tuesday });

    state.typing = true;
    reloads.focus();
    await reloads.settled();

    expect(net.loads).toBe(0);
    expect(state.onScreen.schedule).toBe(tuesday);
  });

  it('reloads once the field is left', async () => {
    const { phone, office } = await twoDevices();
    await phone.saveSchedule(annInShop);
    const { state, reloads } = boardOn(office, { roster, schedule: tuesday });
    state.typing = true;
    reloads.focus();

    state.typing = false;
    reloads.again();
    await reloads.settled();

    expect(state.onScreen.schedule).toEqual(annInShop);
  });

  it('waits, once the field is left, until what was typed is saved', async () => {
    const { office, net } = await twoDevices();
    const { state, board, reloads } = boardOn(office, { roster, schedule: tuesday });
    state.typing = true;
    reloads.focus();

    // Leaving the field commits its text: a change, not saved yet.
    state.typing = false;
    net.holding = true;
    board.edit(bringThePump);
    reloads.again();
    await reloads.settled();
    expect(net.loads).toBe(0);

    net.holding = false;
    net.letThrough();
    await allSaved(office.saves);
    reloads.again();
    await reloads.settled();
    expect(net.loads).toBe(2);
    expect(state.onScreen.schedule).toEqual(addDayNote(tuesday, 'Bring the pump'));
  });

  it('reloads only once for the focus it missed', async () => {
    const { office, net } = await twoDevices();
    const { reloads } = boardOn(office, { roster, schedule: tuesday });

    reloads.again();
    await reloads.settled();

    expect(net.loads).toBe(0);
  });

  it('drops what a reload found when typing began while it was on its way, and reloads once the field is left', async () => {
    const { phone, office, net } = await twoDevices();
    await phone.saveSchedule(annInShop);
    const { state, reloads } = boardOn(office, { roster, schedule: tuesday });

    net.holdingLoads = true;
    reloads.focus();
    state.typing = true;
    net.holdingLoads = false;
    net.letThrough();
    await reloads.settled();
    expect(state.onScreen.schedule).toBe(tuesday);

    state.typing = false;
    reloads.again();
    await reloads.settled();
    expect(state.onScreen.schedule).toEqual(annInShop);
  });
});

describe('when a focus reloads', () => {
  it('never does while a text field on the board has the focus, even with everything saved', () => {
    expect(reloadsOnFocus('saved', true)).toBe(false);
  });


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
