import { describe, expect, it } from 'vitest';
import {
  dailyScheduleFor,
  clearNote,
  fullDate,
  nextWorkingDay,
  scheduleDateOf,
  onJob,
  onStandingRow,
  placeCrewMember,
  returnToNotPlaced,
  scheduleView,
  setNote,
  setTasks,
  tasksText,
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

const tasksOf = (label: string, daily: DailySchedule): string[] =>
  scheduleView(roster, daily).rows.find((row) => row.label === label)?.tasks ?? [];

describe("setting a Job's Tasks", () => {
  it('makes one Task of each line of the text', () => {
    const edited = setTasks(schedule(), 'tower', 'Strip topsoil\nRough grade building pad');

    expect(tasksOf('J100 Tower', edited)).toEqual(['Strip topsoil', 'Rough grade building pad']);
  });

  it('ignores blank lines and the space around each Task', () => {
    const edited = setTasks(schedule(), 'tower', '\n  Strip topsoil  \r\n\n   \nSet curb\n');

    expect(tasksOf('J100 Tower', edited)).toEqual(['Strip topsoil', 'Set curb']);
  });

  it('replaces the Tasks the Job had, and leaves other Jobs alone', () => {
    const before = schedule({ tasks: { tower: ['Strip topsoil'], bridge: ['Set curb'] } });

    const edited = setTasks(before, 'tower', 'Pour footings');

    expect(tasksOf('J100 Tower', edited)).toEqual(['Pour footings']);
    expect(tasksOf('Bridge', edited)).toEqual(['Set curb']);
  });

  it('leaves the Job with no Tasks when the text is empty', () => {
    const before = schedule({ tasks: { tower: ['Strip topsoil'] } });

    expect(tasksOf('J100 Tower', setTasks(before, 'tower', '  \n'))).toEqual([]);
  });

  it('changes nothing when the text gives the Tasks the Job already has', () => {
    const before = schedule({ tasks: { tower: ['Strip topsoil', 'Set curb'] } });

    expect(setTasks(before, 'tower', 'Strip topsoil\nSet curb\n')).toBe(before);
    expect(setTasks(before, 'bridge', '')).toBe(before);
  });

  it('leaves the Daily Schedule it was given untouched', () => {
    const before = schedule({ tasks: { tower: ['Strip topsoil'] } });

    setTasks(before, 'tower', 'Pour footings');

    expect(before.tasks).toEqual({ tower: ['Strip topsoil'] });
  });
});

describe('the text of a Job\'s Tasks', () => {
  it('is one Task per line, and gives the same Tasks back when set again', () => {
    const before = schedule({ tasks: { tower: ['Strip topsoil', 'Set curb'] } });

    expect(tasksText(tasksOf('J100 Tower', before))).toBe('Strip topsoil\nSet curb');
    expect(setTasks(before, 'tower', tasksText(tasksOf('J100 Tower', before)))).toBe(before);
  });
});

const noteOf = (crewMemberId: string, daily: DailySchedule): string | undefined =>
  scheduleView(roster, daily)
    .rows.flatMap((row) => row.who)
    .find((placed) => placed.crewMember.id === crewMemberId)?.note;

describe('setting a Note', () => {
  it("adds the Note to that Crew Member's Placement only", () => {
    const before = schedule({
      placements: [placement('cal', onJob('bridge'), 1), placement('ann', onJob('bridge'), 2)],
    });

    const noted = setNote(before, 'cal', '1/2 Day');

    expect(noteOf('cal', noted)).toBe('1/2 Day');
    expect(noteOf('ann', noted)).toBeUndefined();
  });

  it('replaces the Note the Placement had', () => {
    const before = schedule({ placements: [placement('cal', onJob('bridge'), 1, '1/2 Day')] });

    expect(noteOf('cal', setNote(before, 'cal', 'Leaves at noon'))).toBe('Leaves at noon');
  });

  it('ignores the space around the Note', () => {
    const before = schedule({ placements: [placement('cal', onJob('bridge'), 1)] });

    expect(noteOf('cal', setNote(before, 'cal', '  1/2 Day \n'))).toBe('1/2 Day');
  });

  it('clears the Note when the text is empty', () => {
    const before = schedule({ placements: [placement('cal', onJob('bridge'), 1, '1/2 Day')] });

    const cleared = setNote(before, 'cal', '   ');

    expect(noteOf('cal', cleared)).toBeUndefined();
    expect(whoIsOn('Bridge', cleared)).toEqual(['cal']);
  });

  it('keeps the Crew Member where they are, in the same placement order', () => {
    const before = schedule({
      placements: [placement('cal', onJob('bridge'), 1), placement('ann', onJob('bridge'), 2)],
    });

    expect(whoIsOn('Bridge', setNote(before, 'cal', '1/2 Day'))).toEqual(['cal', 'ann']);
  });

  it('changes nothing when the Placement already has that Note, or has none to clear', () => {
    const before = schedule({
      placements: [placement('cal', onJob('bridge'), 1, '1/2 Day'), placement('ann', onJob('bridge'), 2)],
    });

    expect(setNote(before, 'cal', ' 1/2 Day ')).toBe(before);
    expect(setNote(before, 'ann', '')).toBe(before);
  });

  it('changes nothing for a Crew Member who is Not Placed: a Note belongs to a Placement', () => {
    const before = schedule({ placements: [placement('cal', onJob('bridge'), 1)] });

    expect(setNote(before, 'bob', '1/2 Day')).toBe(before);
  });

  it('leaves the Daily Schedule it was given untouched', () => {
    const before = schedule({ placements: [placement('cal', onJob('bridge'), 1, '1/2 Day')] });

    setNote(before, 'cal', 'Leaves at noon');

    expect(before.placements).toEqual([placement('cal', onJob('bridge'), 1, '1/2 Day')]);
  });
});

describe('clearing a Note', () => {
  it('removes the Note and keeps the Placement', () => {
    const before = schedule({ placements: [placement('cal', onJob('bridge'), 1, '1/2 Day')] });

    const cleared = clearNote(before, 'cal');

    expect(noteOf('cal', cleared)).toBeUndefined();
    expect(whoIsOn('Bridge', cleared)).toEqual(['cal']);
  });

  it('changes nothing when there is no Note', () => {
    const before = schedule({ placements: [placement('cal', onJob('bridge'), 1)] });

    expect(clearNote(before, 'cal')).toBe(before);
  });
});

describe('the full date', () => {
  it('spells out the weekday, month, day and year', () => {
    expect(fullDate('2026-11-10')).toBe('Tuesday, November 10, 2026');
    expect(fullDate('2027-01-01')).toBe('Friday, January 1, 2027');
  });
});

describe('the default date', () => {
  it('is the next weekday after today', () => {
    // Monday evening opens Tuesday.
    expect(nextWorkingDay('2026-11-09')).toBe('2026-11-10');
  });

  it('skips the weekend, so Friday opens Monday', () => {
    expect(nextWorkingDay('2026-11-13')).toBe('2026-11-16');
    expect(nextWorkingDay('2026-11-14')).toBe('2026-11-16');
    expect(nextWorkingDay('2026-11-15')).toBe('2026-11-16');
  });

  it('carries over the end of a month and of a year', () => {
    expect(nextWorkingDay('2026-11-30')).toBe('2026-12-01');
    expect(nextWorkingDay('2026-12-31')).toBe('2027-01-01');
  });

  it("reads today from the clock on the Scheduler's computer", () => {
    expect(scheduleDateOf(new Date(2026, 10, 9, 19, 30))).toBe('2026-11-09');
    expect(scheduleDateOf(new Date(2027, 0, 4, 0, 5))).toBe('2027-01-04');
  });
});

describe('the Daily Schedule for a date', () => {
  const tuesday = schedule({
    date: '2026-11-10',
    placements: [
      placement('fay', onJob('tower'), 1),
      placement('ann', onJob('tower'), 2, '1/2 Day'),
      placement('bob', onStandingRow('off-work'), 3),
      placement('cal', onStandingRow('shop'), 4),
    ],
    tasks: { tower: ['Strip topsoil', 'Set forms'] },
    sends: ['2026-11-09T22:00:00.000Z'],
  });

  it('is created from the most recent earlier one, copying Placements and Tasks', () => {
    const wednesday = dailyScheduleFor(roster, [tuesday], '2026-11-11');

    expect(wednesday.date).toBe('2026-11-11');
    expect(whoIsOn('J100 Tower', wednesday)).toEqual(['fay', 'ann']);
    expect(whoIsOn('Shop', wednesday)).toEqual(['cal']);
    expect(scheduleView(roster, wednesday).rows[0]?.tasks).toEqual(['Strip topsoil', 'Set forms']);
  });

  it('makes Crew Members who were in Off Work Not Placed', () => {
    const wednesday = dailyScheduleFor(roster, [tuesday], '2026-11-11');

    expect(whoIsOn('Off Work', wednesday)).toEqual([]);
    expect(notPlaced(wednesday)).toEqual(['bob']);
  });

  it('drops every Note', () => {
    const wednesday = dailyScheduleFor(roster, [tuesday], '2026-11-11');

    const notes = scheduleView(roster, wednesday).rows.flatMap((row) =>
      row.who.map((placed) => placed.note),
    );
    expect(notes).toEqual([undefined, undefined, undefined]);
  });

  it('starts with no send record', () => {
    expect(dailyScheduleFor(roster, [tuesday], '2026-11-11').sends).toEqual([]);
  });

  it('drops Placements and Tasks for Crew Members and Jobs no longer in the roster', () => {
    const smaller: Roster = {
      crewMembers: roster.crewMembers.filter((member) => member.id !== 'cal'),
      jobs: roster.jobs.filter((job) => job.id !== 'tower'),
    };

    const wednesday = dailyScheduleFor(smaller, [tuesday], '2026-11-11');

    expect(wednesday.placements).toEqual([]);
    expect(wednesday.tasks).toEqual({});
  });

  it('keeps Foreman first and then the placement order of the day before', () => {
    const before = schedule({
      placements: [
        placement('bob', onJob('tower'), 1),
        placement('ann', onJob('tower'), 2),
        placement('fay', onJob('tower'), 3),
      ],
    });

    const next = dailyScheduleFor(roster, [before], '2026-11-11');

    expect(whoIsOn('J100 Tower', next)).toEqual(['fay', 'bob', 'ann']);
  });

  it('copies from the most recent earlier Daily Schedule, whatever order they are given in', () => {
    const monday = schedule({ date: '2026-11-09', placements: [placement('ann', onJob('bridge'), 1)] });
    const friday = schedule({ date: '2026-11-13', placements: [placement('ann', onStandingRow('shop'), 1)] });

    const thursday = dailyScheduleFor(roster, [friday, tuesday, monday], '2026-11-12');

    expect(whoIsOn('J100 Tower', thursday)).toEqual(['fay', 'ann']);
  });

  it('opens the Daily Schedule already saved for that date instead of creating one', () => {
    const wednesday = schedule({
      date: '2026-11-11',
      placements: [placement('ann', onStandingRow('trucking'), 1, 'Late')],
      sends: ['2026-11-10T22:00:00.000Z'],
    });

    expect(dailyScheduleFor(roster, [tuesday, wednesday], '2026-11-11')).toEqual(wednesday);
    expect(dailyScheduleFor(roster, [tuesday, wednesday], '2026-11-10')).toEqual(tuesday);
  });

  it('leaves the earlier Daily Schedule as it was', () => {
    const before = structuredClone(tuesday);

    dailyScheduleFor(roster, [tuesday], '2026-11-11');

    expect(tuesday).toEqual(before);
  });

  it('starts with everyone Not Placed and no Tasks when there is no earlier Daily Schedule', () => {
    const monday = dailyScheduleFor(roster, [tuesday], '2026-11-09');

    expect(monday).toEqual({ date: '2026-11-09', placements: [], tasks: {}, sends: [] });
    expect(dailyScheduleFor(roster, [], '2026-11-09')).toEqual(monday);
  });
});
