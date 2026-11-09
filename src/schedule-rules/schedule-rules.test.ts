import { describe, expect, it } from 'vitest';
import {
  fullDate,
  onJob,
  onStandingRow,
  placeCrewMember,
  returnToNotPlaced,
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

const whoIsOn = (label: string, daily: DailySchedule) =>
  scheduleView(roster, daily)
    .rows.find((row) => row.label === label)
    ?.who.map((placed) => placed.crewMember.name);

const notPlaced = (daily: DailySchedule) =>
  scheduleView(roster, daily).notPlaced.map((crewMember) => crewMember.name);

describe('placing a Crew Member', () => {
  it('puts a Not Placed Crew Member on the Job', () => {
    const moved = placeCrewMember(schedule(), 'ann', onJob('tower'));

    expect(whoIsOn('J100 Tower', moved)).toEqual(['ann']);
    expect(notPlaced(moved)).toEqual(['bob', 'fay', 'cal']);
  });

  it('replaces the old Placement, so a Crew Member never appears in two places', () => {
    const before = schedule({
      placements: [placement('ann', onJob('tower'), 1), placement('bob', onJob('tower'), 2)],
    });

    const moved = placeCrewMember(before, 'ann', onStandingRow('trucking'));

    expect(whoIsOn('J100 Tower', moved)).toEqual(['bob']);
    expect(whoIsOn('Trucking', moved)).toEqual(['ann']);
    expect(moved.placements.filter((p) => p.crewMemberId === 'ann')).toHaveLength(1);
  });

  it('lists a newly placed Crew Member after those already there', () => {
    const before = schedule({
      placements: [
        placement('cal', onStandingRow('shop'), 7),
        placement('bob', onJob('tower'), 5),
        placement('ann', onJob('bridge'), 9),
      ],
    });

    const moved = placeCrewMember(placeCrewMember(before, 'ann', onJob('tower')), 'cal', onJob('tower'));

    expect(whoIsOn('J100 Tower', moved)).toEqual(['bob', 'ann', 'cal']);
  });

  it('lists a newly placed Foreman first on a Job', () => {
    const before = schedule({
      placements: [placement('bob', onJob('tower'), 1), placement('ann', onJob('tower'), 2)],
    });

    const moved = placeCrewMember(before, 'fay', onJob('tower'));

    expect(whoIsOn('J100 Tower', moved)).toEqual(['fay', 'bob', 'ann']);
  });

  it('leaves the Note behind when a Crew Member moves', () => {
    const before = schedule({ placements: [placement('cal', onJob('bridge'), 1, '1/2 Day')] });

    const moved = placeCrewMember(before, 'cal', onJob('tower'));

    const cal = scheduleView(roster, moved).rows.find((row) => row.label === 'J100 Tower')?.who[0];
    expect(cal?.crewMember.name).toBe('cal');
    expect(cal?.note).toBeUndefined();
  });

  it('changes nothing when the Crew Member is already on that Job or Standing Row', () => {
    const before = schedule({
      placements: [
        placement('cal', onJob('bridge'), 1, '1/2 Day'),
        placement('ann', onJob('bridge'), 2),
      ],
    });

    expect(placeCrewMember(before, 'cal', onJob('bridge'))).toBe(before);
  });

  it('leaves the Daily Schedule it was given untouched', () => {
    const before = schedule({ placements: [placement('ann', onJob('tower'), 1)] });

    placeCrewMember(before, 'ann', onJob('bridge'));

    expect(before.placements).toEqual([placement('ann', onJob('tower'), 1)]);
  });
});

describe('returning a Crew Member to Not Placed', () => {
  it('removes their Placement', () => {
    const before = schedule({
      placements: [placement('ann', onJob('tower'), 1), placement('bob', onJob('tower'), 2)],
    });

    const moved = returnToNotPlaced(before, 'bob');

    expect(whoIsOn('J100 Tower', moved)).toEqual(['ann']);
    expect(notPlaced(moved)).toEqual(['bob', 'fay', 'cal']);
  });

  it('changes nothing when the Crew Member is already Not Placed', () => {
    const before = schedule({ placements: [placement('ann', onJob('tower'), 1)] });

    expect(returnToNotPlaced(before, 'bob')).toBe(before);
  });
});

describe('the full date', () => {
  it('spells out the weekday, month, day and year', () => {
    expect(fullDate('2026-11-10')).toBe('Tuesday, November 10, 2026');
    expect(fullDate('2027-01-01')).toBe('Friday, January 1, 2027');
  });
});

// ---------------------------------------------------------------------------
// The roster, as managed on the settings page
// ---------------------------------------------------------------------------

import {
  addCrewMember,
  addJob,
  changeCrewMember,
  moveJob,
  removeCrewMember,
  removeJob,
} from './index';

describe('adding a Crew Member to the roster', () => {
  it('adds them with their name, color and Foreman flag, and they are Not Placed', () => {
    const added = addCrewMember(roster, { name: 'Dee Young', color: 'yellow', foreman: true });

    expect(added.crewMembers.at(-1)).toMatchObject({
      name: 'Dee Young',
      color: 'yellow',
      foreman: true,
    });
    const daily = schedule({ placements: [placement('ann', onJob('tower'), 1)] });
    expect(scheduleView(added, daily).notPlaced.map((member) => member.name)).toEqual([
      'bob',
      'fay',
      'cal',
      'Dee Young',
    ]);
  });

  it('gives two Crew Members with the same name different ids', () => {
    const details = { name: 'Dee Young', color: 'blue', foreman: false } as const;

    const added = addCrewMember(addCrewMember(roster, details), details);

    const ids = added.crewMembers.map((member) => member.id);
    expect(new Set(ids).size).toBe(6);
  });

  it('trims the name', () => {
    const added = addCrewMember(roster, { name: '  Dee Young ', color: 'blue', foreman: false });

    expect(added.crewMembers.at(-1)?.name).toBe('Dee Young');
  });

  it('changes nothing when the name is blank', () => {
    expect(addCrewMember(roster, { name: '   ', color: 'blue', foreman: false })).toBe(roster);
  });
});

describe('changing a Crew Member', () => {
  it('changes their name, color and Foreman flag and keeps their Placement', () => {
    const changed = changeCrewMember(roster, 'ann', {
      name: ' Ann Lee ',
      color: 'red',
      foreman: true,
    });

    const daily = schedule({
      placements: [placement('bob', onJob('tower'), 1), placement('ann', onJob('tower'), 2)],
    });
    const tower = scheduleView(changed, daily).rows.find((row) => row.label === 'J100 Tower');
    expect(tower?.who.map((placed) => placed.crewMember)).toEqual([
      { id: 'ann', name: 'Ann Lee', color: 'red', foreman: true },
      { id: 'bob', name: 'bob', color: 'blue', foreman: false },
    ]);
  });

  it('changes only what is given', () => {
    const changed = changeCrewMember(roster, 'fay', { color: 'orange' });

    expect(changed.crewMembers.find((member) => member.id === 'fay')).toEqual({
      id: 'fay',
      name: 'fay',
      color: 'orange',
      foreman: true,
    });
  });

  it('changes nothing when the new name is blank', () => {
    expect(changeCrewMember(roster, 'ann', { name: '  ' })).toBe(roster);
  });
});

describe('removing a Crew Member from the roster', () => {
  it('takes them off the Daily Schedule being edited, placed or Not Placed', () => {
    const daily = schedule({ placements: [placement('ann', onJob('tower'), 1)] });

    const withoutAnn = scheduleView(removeCrewMember(roster, 'ann'), daily);
    const withoutBob = scheduleView(removeCrewMember(roster, 'bob'), daily);

    expect(withoutAnn.rows.flatMap((row) => row.who)).toEqual([]);
    expect(withoutAnn.notPlaced.map((member) => member.name)).toEqual(['bob', 'fay', 'cal']);
    expect(withoutBob.notPlaced.map((member) => member.name)).toEqual(['fay', 'cal']);
  });

  it('does not reuse the id of someone still in the roster when a name is added again', () => {
    const added = addCrewMember(removeCrewMember(roster, 'bob'), {
      name: 'Ann',
      color: 'blue',
      foreman: false,
    });

    expect(added.crewMembers.map((member) => member.id)).toEqual(['ann', 'fay', 'cal', 'ann-2']);
  });
});

const jobLabels = (ofRoster: Roster) =>
  scheduleView(ofRoster, schedule())
    .rows.filter((row) => row.destination.kind === 'job')
    .map((row) => row.label);

describe('adding a Job to the roster', () => {
  it('adds it after the other Jobs, with or without a job number', () => {
    const added = addJob(addJob(roster, { name: ' Depot ', jobNumber: ' J300 ' }), {
      name: 'Quarry',
      jobNumber: '  ',
    });

    expect(jobLabels(added)).toEqual(['J100 Tower', 'Bridge', 'J300 Depot', 'Quarry']);
    expect(added.jobs.at(-1)).toEqual({ id: 'quarry', name: 'Quarry' });
  });

  it('gives two Jobs with the same name different ids', () => {
    const added = addJob(addJob(roster, { name: 'Bridge' }), { name: 'Bridge' });

    expect(new Set(added.jobs.map((job) => job.id)).size).toBe(4);
  });

  it('changes nothing when the name is blank', () => {
    expect(addJob(roster, { name: ' ', jobNumber: 'J300' })).toBe(roster);
  });
});

describe('removing a Job from the roster', () => {
  it('takes the Job off the Daily Schedule and makes everyone on it Not Placed', () => {
    const daily = schedule({
      placements: [
        placement('ann', onJob('tower'), 1),
        placement('fay', onJob('tower'), 2),
        placement('bob', onJob('bridge'), 3),
      ],
    });

    const view = scheduleView(removeJob(roster, 'tower'), daily);

    expect(view.rows.map((row) => row.label)).toEqual(['Bridge', 'Shop', 'Trucking', 'Off Work']);
    expect(view.notPlaced.map((member) => member.name)).toEqual(['ann', 'fay', 'cal']);
  });
});

describe('reordering Jobs', () => {
  it('moves a Job up or down one place in the display order', () => {
    const three = addJob(roster, { name: 'Depot' });

    expect(jobLabels(moveJob(three, 'depot', 'up'))).toEqual(['J100 Tower', 'Depot', 'Bridge']);
    expect(jobLabels(moveJob(three, 'tower', 'down'))).toEqual(['Bridge', 'J100 Tower', 'Depot']);
  });

  it('changes nothing when the Job is already first or last', () => {
    expect(moveJob(roster, 'tower', 'up')).toBe(roster);
    expect(moveJob(roster, 'bridge', 'down')).toBe(roster);
  });
});
