import { describe, expect, it } from 'vitest';
import { NOT_PLACED, onJob, scheduleView, type DailySchedule, type Roster } from '../schedule-rules';
import { inHand, isTarget, nameClick, selectionOf } from './selection';

const roster: Roster = {
  crewMembers: [
    { id: 'ann', name: 'Ann Lee', color: 'blue', foreman: true },
    { id: 'bob', name: 'Bob Ray', color: 'orange', foreman: false },
    { id: 'cal', name: 'Cal Day', color: 'grey', foreman: false },
  ],
  jobs: [
    { id: 'tower', name: 'Tower' },
    { id: 'bridge', name: 'Bridge' },
  ],
};

/** Ann and Bob on Tower; Cal Not Placed. */
const schedule: DailySchedule = {
  date: '2026-11-12',
  placements: [
    { crewMemberId: 'ann', destination: onJob('tower'), order: 1, note: '1/2 Day' },
    { crewMemberId: 'bob', destination: onJob('tower'), order: 2 },
  ],
  tasks: {},
  sends: [],
};
const view = scheduleView(roster, schedule);

describe('what selecting a name means', () => {
  it('is nothing with nobody selected, or someone no longer on the board', () => {
    expect(selectionOf(view, null)).toEqual({ mode: 'none' });
    expect(selectionOf(view, 'gone')).toEqual({ mode: 'none' });
  });

  it('picks up someone Not Placed to move', () => {
    const selection = selectionOf(view, 'cal');
    expect(selection.mode).toBe('moving');
  });

  it('opens the panel of someone placed, with their Note', () => {
    const selection = selectionOf(view, 'ann');
    expect(selection.mode === 'panel' && selection.placed.note).toBe('1/2 Day');
  });
});

describe('who is in hand, and where they can go', () => {
  it('is someone picked up to move: everywhere but Not Placed is a target', () => {
    const hand = inHand(view, selectionOf(view, 'cal'), null);
    expect(hand?.from).toBe(NOT_PLACED);
    expect(isTarget(hand, 'job:tower')).toBe(true);
    expect(isTarget(hand, NOT_PLACED)).toBe(false);
  });

  it('is nobody while a panel is open: nothing is a target', () => {
    const hand = inHand(view, selectionOf(view, 'ann'), null);
    expect(hand).toBeUndefined();
    expect(isTarget(hand, 'job:bridge')).toBe(false);
  });

  it('is the one being dragged, even with a panel open: their own row stays plain', () => {
    const hand = inHand(view, selectionOf(view, 'ann'), 'ann');
    expect(hand?.crewMember.id).toBe('ann');
    expect(isTarget(hand, 'job:tower')).toBe(false);
    expect(isTarget(hand, 'job:bridge')).toBe(true);
  });
});

describe('a click on a name', () => {
  it('selects it when nobody is selected', () => {
    expect(nameClick(selectionOf(view, null), 'bob')).toBe('select');
  });

  it('lets go when it is the one selected, in either mode', () => {
    expect(nameClick(selectionOf(view, 'ann'), 'ann')).toBe('deselect');
    expect(nameClick(selectionOf(view, 'cal'), 'cal')).toBe('deselect');
  });

  it('selects another name instead while a panel is open', () => {
    expect(nameClick(selectionOf(view, 'ann'), 'bob')).toBe('select');
  });

  it('carries on to the card it is on while someone is picked up: a move there', () => {
    expect(nameClick(selectionOf(view, 'cal'), 'bob')).toBe('pass-through');
  });
});
