import { describe, expect, it } from 'vitest';
import { onJob, onStandingRow, scheduleView, type DailySchedule, type Roster } from '../schedule-rules';
import { jumpDistance, jumpStrip } from './jumpStrip';

const roster: Roster = {
  crewMembers: [
    { id: 'ann', name: 'Ann Lee', color: 'blue', foreman: true },
    { id: 'bob', name: 'Bob Ray', color: 'orange', foreman: false },
  ],
  jobs: [
    { id: 'tower', name: 'Tower', jobNumber: 'J100' },
    { id: 'bridge', name: 'Bridge' },
    { id: 'pond', name: 'Pond' },
  ],
};

/** Ann on Tower, Bob in the Shop: Bridge and Pond have nobody. */
const schedule: DailySchedule = {
  date: '2026-11-12',
  placements: [
    { crewMemberId: 'ann', destination: onJob('tower'), order: 1 },
    { crewMemberId: 'bob', destination: onStandingRow('shop'), order: 2 },
  ],
  tasks: {},
  sends: [],
};

const view = scheduleView(roster, schedule);
const names = (open: string[]) => jumpStrip(roster, view, new Set(open)).map((stop) => stop.name);

describe('the strip to jump along', () => {
  it('lists every open Job by its name, then Shop, Trucking and Off Work', () => {
    expect(names(['job:tower', 'job:pond'])).toEqual(['Tower', 'Pond', 'Shop', 'Trucking', 'Off Work']);
  });

  it('keeps the Jobs in the order of the board, whatever order they were opened in', () => {
    expect(names(['job:pond', 'job:bridge', 'job:tower'])).toEqual([
      'Tower',
      'Bridge',
      'Pond',
      'Shop',
      'Trucking',
      'Off Work',
    ]);
  });

  it('leaves out a folded Job: it has no card to jump to', () => {
    expect(names(['job:tower'])).not.toContain('Bridge');
  });

  it('is the three Standing Rows alone when no Job is open', () => {
    expect(names([])).toEqual(['Shop', 'Trucking', 'Off Work']);
  });

  it('says which card each stop jumps to', () => {
    expect(jumpStrip(roster, view, new Set(['job:tower'])).map((stop) => stop.key)).toEqual([
      'job:tower',
      'standing-row:shop',
      'standing-row:trucking',
      'standing-row:off-work',
    ]);
  });
});

describe('how far a jump scrolls', () => {
  it('brings the top of the card to the top of the page of cards, with a little air', () => {
    expect(jumpDistance({ cardTop: 900, pageTop: 100, coveredTo: 100, air: 8 })).toBe(792);
  });

  it('stops short of what stays over the top of the page: the Not Placed list', () => {
    expect(jumpDistance({ cardTop: 900, pageTop: 100, coveredTo: 260, air: 8 })).toBe(632);
  });

  it('scrolls back for a card above', () => {
    expect(jumpDistance({ cardTop: -300, pageTop: 100, coveredTo: 100, air: 8 })).toBe(-408);
  });

  it('takes no notice of a cover that is not over the page', () => {
    expect(jumpDistance({ cardTop: 900, pageTop: 100, coveredTo: 0, air: 8 })).toBe(792);
  });
});
