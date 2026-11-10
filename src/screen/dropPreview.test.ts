import { describe, expect, it } from 'vitest';
import {
  NOT_PLACED,
  onJob,
  onStandingRow,
  scheduleView,
  type CrewMember,
  type DailySchedule,
  type Roster,
  type ScheduleView,
} from '../schedule-rules';
import { viewWhileDragging } from './dropPreview';

const crew = (id: string, overrides: Partial<CrewMember> = {}): CrewMember => ({
  id,
  name: id,
  color: 'blue',
  foreman: false,
  ...overrides,
});

const roster: Roster = {
  crewMembers: [crew('ann'), crew('bob'), crew('fay', { foreman: true }), crew('cal')],
  jobs: [
    { id: 'tower', name: 'Tower' },
    { id: 'bridge', name: 'Bridge' },
  ],
};

/** Ann then Bob on Tower, Cal in the Shop; Fay (a Foreman) is Not Placed. */
const schedule: DailySchedule = {
  date: '2026-11-10',
  placements: [
    { crewMemberId: 'ann', destination: onJob('tower'), order: 1, note: '1/2 Day' },
    { crewMemberId: 'bob', destination: onJob('tower'), order: 2 },
    { crewMemberId: 'cal', destination: onStandingRow('shop'), order: 3 },
  ],
  tasks: {},
  sends: [],
};

const whoIsOn = (shown: ScheduleView, key: string) =>
  shown.rows.find((row) => row.key === key)?.who.map((placed) => placed.crewMember.id);

const notPlaced = (shown: ScheduleView) => shown.notPlaced.map((crewMember) => crewMember.id);

describe('the schedule drawn while a name is dragged', () => {
  it('shows a Foreman held over a Job first on it, ahead of those already there', () => {
    const shown = viewWhileDragging(roster, schedule, { crewMemberId: 'fay', over: 'job:tower' });

    expect(whoIsOn(shown, 'job:tower')).toEqual(['fay', 'ann', 'bob']);
    expect(notPlaced(shown)).toEqual([]);
  });

  it('shows anyone else held over a Job or Standing Row last on it, and gone from where they were', () => {
    const overBridge = viewWhileDragging(roster, schedule, { crewMemberId: 'ann', over: 'job:bridge' });
    expect(whoIsOn(overBridge, 'job:bridge')).toEqual(['ann']);
    expect(whoIsOn(overBridge, 'job:tower')).toEqual(['bob']);

    const overShop = viewWhileDragging(roster, schedule, {
      crewMemberId: 'ann',
      over: 'standing-row:shop',
    });
    expect(whoIsOn(overShop, 'standing-row:shop')).toEqual(['cal', 'ann']);
  });

  it('shows a name held over the Not Placed list where the roster lists them', () => {
    const shown = viewWhileDragging(roster, schedule, { crewMemberId: 'ann', over: NOT_PLACED });

    expect(notPlaced(shown)).toEqual(['ann', 'fay']);
    expect(whoIsOn(shown, 'job:tower')).toEqual(['bob']);
  });

  it('is the schedule as it stands when nothing is dragged, or the name is over no destination', () => {
    const asItStands = scheduleView(roster, schedule);

    expect(viewWhileDragging(roster, schedule, null)).toEqual(asItStands);
    expect(viewWhileDragging(roster, schedule, { crewMemberId: 'ann', over: null })).toEqual(asItStands);
    expect(viewWhileDragging(roster, schedule, { crewMemberId: 'ann', over: 'job:gone' })).toEqual(
      asItStands,
    );
  });

  it('leaves a name held over the row it is already on where it is, Note and all', () => {
    const shown = viewWhileDragging(roster, schedule, { crewMemberId: 'ann', over: 'job:tower' });

    expect(shown).toEqual(scheduleView(roster, schedule));
    expect(shown.rows[0]?.who[0]?.note).toBe('1/2 Day');
  });
});
