import { describe, expect, it } from 'vitest';
import { markSent, moveCrewMember, NOT_PLACED, onJob, crewView, type DailySchedule, type Roster } from '../schedule-rules';
import { emptyHistory, remember, undo, UNDO_LIMIT } from './undoHistory';

const roster: Roster = {
  crewMembers: [{ id: 'ann', name: 'Ann Lee', color: 'blue', foreman: false }],
  jobs: [
    { id: 'tower', name: 'Tower' },
    { id: 'bridge', name: 'Bridge' },
  ],
};

const start: DailySchedule = {
  date: '2026-11-12',
  placements: [{ crewMemberId: 'ann', destination: onJob('tower'), order: 1 }],
  tasks: {},
  sends: [],
};

describe('undo', () => {
  it('has nothing to undo at first', () => {
    expect(undo(emptyHistory, start)).toBeNull();
  });

  it('takes back the latest edit, then the one before', () => {
    const moved = moveCrewMember(start, 'ann', onJob('bridge'));
    const unplaced = moveCrewMember(moved, 'ann', NOT_PLACED);
    const history = remember(remember(emptyHistory, start), moved);

    const once = undo(history, unplaced)!;
    expect(once.schedule).toEqual(moved);
    const twice = undo(once.history, once.schedule)!;
    expect(twice.schedule).toEqual(start);
    expect(undo(twice.history, twice.schedule)).toBeNull();
  });

  it('never takes back a Send: the send record stays', () => {
    const moved = moveCrewMember(start, 'ann', onJob('bridge'));
    const sent = markSent(moved, crewView(roster, moved), '2026-11-11T18:00:00.000Z');
    const back = undo(remember(emptyHistory, start), sent)!;

    expect(back.schedule.placements).toEqual(start.placements);
    expect(back.schedule.sends).toEqual(sent.sends);
    // Changed back after the Send, so the next crew view is marked updated.
    expect(crewView(roster, back.schedule).updated).toBe(true);
  });

  it(`keeps only the last ${UNDO_LIMIT} edits`, () => {
    let history = emptyHistory;
    for (let index = 0; index < UNDO_LIMIT + 5; index++) {
      history = remember(history, { ...start, tasks: { tower: [`step ${index}`] } });
    }
    expect(history).toHaveLength(UNDO_LIMIT);
    expect(history[0]!.tasks.tower).toEqual(['step 5']);
  });
});
