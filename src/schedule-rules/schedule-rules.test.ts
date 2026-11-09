import { describe, expect, it } from 'vitest';
import {
  clearNote,
  fullDate,
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

// ---------------------------------------------------------------------------
// Send (ticket #8). Kept together at the end of the file, with its own import.
// ---------------------------------------------------------------------------

import { crewView, lastSentAt, markSent, sendCheck } from './index';

/** Everyone in the roster placed: ann and fay on Tower, bob in the Shop, cal Off Work. */
const everyonePlaced = (overrides: Partial<DailySchedule> = {}): DailySchedule =>
  schedule({
    placements: [
      placement('ann', onJob('tower'), 1),
      placement('fay', onJob('tower'), 2),
      placement('bob', onStandingRow('shop'), 3),
      placement('cal', onStandingRow('off-work'), 4),
    ],
    ...overrides,
  });

describe('whether Send is allowed', () => {
  it('is refused while anyone is Not Placed, naming them in roster order', () => {
    const check = sendCheck(roster, schedule({ placements: [placement('bob', onJob('tower'), 1)] }));

    expect(check.allowed).toBe(false);
    expect(check.notPlaced.map((crewMember) => crewMember.name)).toEqual(['ann', 'fay', 'cal']);
  });

  it('is allowed once every Crew Member has a Placement, Off Work included', () => {
    expect(sendCheck(roster, everyonePlaced())).toEqual({ allowed: true, notPlaced: [] });
  });
});

describe('marking a Daily Schedule as Sent', () => {
  it('has never been sent to begin with', () => {
    expect(lastSentAt(everyonePlaced())).toBeUndefined();
  });

  it('adds the time of the Send to the send record, keeping earlier Sends', () => {
    const once = markSent(everyonePlaced(), '2026-11-09T23:05:00.000Z');
    const twice = markSent(once, '2026-11-09T23:40:00.000Z');

    expect(once.sends).toEqual(['2026-11-09T23:05:00.000Z']);
    expect(twice.sends).toEqual(['2026-11-09T23:05:00.000Z', '2026-11-09T23:40:00.000Z']);
    expect(lastSentAt(twice)).toBe('2026-11-09T23:40:00.000Z');
  });

  it('changes nothing else, and leaves the Daily Schedule it was given untouched', () => {
    const before = everyonePlaced({ tasks: { tower: ['Pour footings'] } });

    const sent = markSent(before, '2026-11-09T23:05:00.000Z');

    expect(before.sends).toEqual([]);
    expect(scheduleView(roster, sent)).toEqual(scheduleView(roster, before));
  });
});

describe('the crew view', () => {
  it('lists the Jobs and Standing Rows that have someone on them, in schedule order', () => {
    const view = crewView(roster, everyonePlaced());

    expect(view.date).toBe('2026-11-10');
    expect(view.rows.map((row) => row.label)).toEqual(['J100 Tower', 'Shop', 'Off Work']);
  });

  it('leaves out a Job with nobody on it, even when it has Tasks', () => {
    const view = crewView(roster, everyonePlaced({ tasks: { bridge: ['Set bearings'] } }));

    expect(view.rows.map((row) => row.label)).not.toContain('Bridge');
  });

  it('leaves out a Standing Row with nobody on it', () => {
    const view = crewView(roster, everyonePlaced());

    expect(view.rows.map((row) => row.label)).not.toContain('Trucking');
  });

  it('shows each row as the Scheduler sees it: Tasks, Foreman first, colors and Notes', () => {
    const view = crewView(
      roster,
      schedule({
        placements: [
          placement('cal', onJob('tower'), 1, '1/2 Day'),
          placement('fay', onJob('tower'), 2),
        ],
        tasks: { tower: ['Pour footings', 'Strip forms'] },
      }),
    );

    const [tower] = view.rows;
    expect(tower?.tasks).toEqual(['Pour footings', 'Strip forms']);
    expect(tower?.who.map(({ crewMember, note }) => [crewMember.name, crewMember.color, note])).toEqual([
      ['fay', 'grey', undefined],
      ['cal', 'orange', '1/2 Day'],
    ]);
  });

  it('is not marked UPDATED for a Daily Schedule that has never been sent', () => {
    expect(crewView(roster, everyonePlaced()).updated).toBe(false);
  });

  it('is marked UPDATED once the Daily Schedule has been sent before, so on a second or later Send', () => {
    const sentOnce = markSent(everyonePlaced(), '2026-11-09T23:05:00.000Z');
    const sentTwice = markSent(sentOnce, '2026-11-09T23:40:00.000Z');

    expect(crewView(roster, sentOnce).updated).toBe(true);
    expect(crewView(roster, sentTwice).updated).toBe(true);
  });
});
