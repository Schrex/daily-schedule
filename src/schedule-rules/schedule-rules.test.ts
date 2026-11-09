import { describe, expect, it } from 'vitest';
import {
  fullDate,
  onJob,
  onStandingRow,
  scheduleView,
  type CrewMember,
  type DailySchedule,
  type Placement,
  type Roster,
} from './index';

const crew = (id: string, overrides: Partial<CrewMember> = {}): CrewMember => ({
  id,
  name: id,
  color: 'blue',
  foreman: false,
  ...overrides,
});

const roster: Roster = {
  crewMembers: [
    crew('ann'),
    crew('bob'),
    crew('fay', { foreman: true, color: 'grey' }),
    crew('cal', { color: 'orange' }),
  ],
  jobs: [
    { id: 'tower', name: 'Tower', jobNumber: 'J100' },
    { id: 'bridge', name: 'Bridge' },
  ],
};

const schedule = (overrides: Partial<DailySchedule> = {}): DailySchedule => ({
  date: '2026-11-10',
  placements: [],
  tasks: {},
  sends: [],
  ...overrides,
});

const placement = (
  crewMemberId: string,
  destination: Placement['destination'],
  order: number,
  note?: string,
): Placement => ({ crewMemberId, destination, order, ...(note ? { note } : {}) });

describe('the Daily Schedule view', () => {
  it('lists Jobs in roster order, followed by the Standing Rows Shop, Trucking and Off Work', () => {
    const view = scheduleView(roster, schedule());

    expect(view.rows.map((row) => row.label)).toEqual([
      'J100 Tower',
      'Bridge',
      'Shop',
      'Trucking',
      'Off Work',
    ]);
  });

  it('lists the Foreman first on a Job, then the other Crew Members in placement order', () => {
    const view = scheduleView(
      roster,
      schedule({
        placements: [
          placement('fay', onJob('tower'), 3),
          placement('ann', onJob('tower'), 2),
          placement('bob', onJob('tower'), 1),
        ],
      }),
    );

    const tower = view.rows.find((row) => row.label === 'J100 Tower');
    expect(tower?.who.map((placed) => placed.crewMember.name)).toEqual(['fay', 'bob', 'ann']);
  });

  it('lists Crew Members on a Standing Row in placement order, Foreman or not', () => {
    const view = scheduleView(
      roster,
      schedule({
        placements: [
          placement('fay', onStandingRow('shop'), 4),
          placement('ann', onStandingRow('shop'), 2),
          placement('cal', onStandingRow('shop'), 1),
          placement('bob', onStandingRow('off-work'), 3),
        ],
      }),
    );

    const who = (label: string) =>
      view.rows.find((row) => row.label === label)?.who.map((placed) => placed.crewMember.name);
    expect(who('Shop')).toEqual(['cal', 'ann', 'fay']);
    expect(who('Trucking')).toEqual([]);
    expect(who('Off Work')).toEqual(['bob']);
  });

  it('keeps a Job with nobody on it, with an empty WHO list', () => {
    const view = scheduleView(roster, schedule({ placements: [placement('ann', onJob('tower'), 1)] }));

    expect(view.rows.find((row) => row.label === 'Bridge')?.who).toEqual([]);
  });

  it('shows each Crew Member with their color and the Note on their Placement', () => {
    const view = scheduleView(
      roster,
      schedule({
        placements: [
          placement('cal', onJob('bridge'), 1, '1/2 Day'),
          placement('ann', onJob('bridge'), 2),
        ],
      }),
    );

    const [cal, ann] = view.rows.find((row) => row.label === 'Bridge')?.who ?? [];
    expect(cal?.crewMember.color).toBe('orange');
    expect(cal?.note).toBe('1/2 Day');
    expect(ann?.crewMember.color).toBe('blue');
    expect(ann?.note).toBeUndefined();
  });

  it('shows the Tasks for each Job', () => {
    const view = scheduleView(
      roster,
      schedule({ tasks: { tower: ['Strip topsoil', 'Set forms'] } }),
    );

    const tasks = (label: string) => view.rows.find((row) => row.label === label)?.tasks;
    expect(tasks('J100 Tower')).toEqual(['Strip topsoil', 'Set forms']);
    expect(tasks('Bridge')).toEqual([]);
    expect(tasks('Shop')).toEqual([]);
  });

  it('lists every Crew Member without a Placement as Not Placed, in roster order', () => {
    const view = scheduleView(
      roster,
      schedule({
        placements: [
          placement('bob', onJob('tower'), 1),
          placement('fay', onStandingRow('trucking'), 2),
        ],
      }),
    );

    expect(view.notPlaced.map((crewMember) => crewMember.name)).toEqual(['ann', 'cal']);
  });

  it('treats a Crew Member placed on a Job that is no longer in the roster as Not Placed', () => {
    const view = scheduleView(
      roster,
      schedule({ placements: [placement('bob', onJob('finished-job'), 1)] }),
    );

    expect(view.notPlaced.map((crewMember) => crewMember.name)).toContain('bob');
  });
});

describe('the full date', () => {
  it('spells out the weekday, month, day and year', () => {
    expect(fullDate('2026-11-10')).toBe('Tuesday, November 10, 2026');
    expect(fullDate('2027-01-01')).toBe('Friday, January 1, 2027');
  });
});
