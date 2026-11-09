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
  canUndo,
  change,
  startEditing,
  undo,
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

describe('Undo', () => {
  it('reverses the most recent Placement', () => {
    const opened = schedule({ placements: [placement('cal', onJob('bridge'), 1)] });

    const moved = change(startEditing(opened), (s) => placeCrewMember(s, 'cal', onJob('tower')));
    expect(whoIsOn('J100 Tower', moved.schedule)).toEqual(['cal']);

    const undone = undo(moved);

    expect(whoIsOn('Bridge', undone.schedule)).toEqual(['cal']);
    expect(whoIsOn('J100 Tower', undone.schedule)).toEqual([]);
  });

  it('steps back through a Placement, a Task edit and a Note edit in order, most recent first', () => {
    const opened = schedule({
      placements: [placement('cal', onJob('bridge'), 1)],
      tasks: { bridge: ['Pour deck'] },
    });

    const moved = change(startEditing(opened), (s) => placeCrewMember(s, 'ann', onJob('bridge')));
    const retasked = change(moved, (s) => setTasks(s, 'bridge', 'Strip forms'));
    const noted = change(retasked, (s) => setNote(s, 'cal', '1/2 Day'));

    const noteUndone = undo(noted);
    expect(noteOf('cal', noteUndone.schedule)).toBeUndefined();
    expect(tasksOf('Bridge', noteUndone.schedule)).toEqual(['Strip forms']);
    expect(canUndo(noteUndone)).toBe(true);

    const tasksUndone = undo(noteUndone);
    expect(tasksOf('Bridge', tasksUndone.schedule)).toEqual(['Pour deck']);
    expect(whoIsOn('Bridge', tasksUndone.schedule)).toEqual(['cal', 'ann']);
    expect(canUndo(tasksUndone)).toBe(true);

    const moveUndone = undo(tasksUndone);
    expect(moveUndone.schedule).toEqual(opened);
    expect(canUndo(moveUndone)).toBe(false);
  });

  it('has nothing to undo when a Daily Schedule is first opened, and Undo then changes nothing', () => {
    const editing = startEditing(schedule({ placements: [placement('cal', onJob('bridge'), 1)] }));

    expect(canUndo(editing)).toBe(false);
    expect(undo(editing)).toBe(editing);
  });

  it('does not count a change that changed nothing', () => {
    const editing = startEditing(schedule({ placements: [placement('cal', onJob('bridge'), 1)] }));

    const same = change(editing, (s) => placeCrewMember(s, 'cal', onJob('bridge')));

    expect(same).toBe(editing);
    expect(canUndo(same)).toBe(false);
  });

  it('does not undo a Send: the send record survives, and the change before the Send is reversed', () => {
    const opened = schedule({ placements: [placement('cal', onJob('bridge'), 1)] });
    const send = (s: DailySchedule): DailySchedule => ({
      ...s,
      sends: [...s.sends, '2026-11-09T22:15:00.000Z'],
    });

    const moved = change(startEditing(opened), (s) => placeCrewMember(s, 'cal', onJob('tower')));
    const sent = change(moved, send);
    expect(sent.schedule.sends).toEqual(['2026-11-09T22:15:00.000Z']);

    const undone = undo(sent);

    expect(undone.schedule.sends).toEqual(['2026-11-09T22:15:00.000Z']);
    expect(whoIsOn('Bridge', undone.schedule)).toEqual(['cal']);
    expect(canUndo(undone)).toBe(false);
  });

  it('never loses a Send made after the change being undone', () => {
    const send = (s: DailySchedule): DailySchedule => ({ ...s, sends: [...s.sends, 'first'] });
    const moved = change(startEditing(schedule()), (s) => placeCrewMember(s, 'cal', onJob('tower')));
    const noted = change(change(moved, send), (s) => setNote(s, 'cal', '1/2 Day'));

    const undoneTwice = undo(undo(noted));

    expect(undoneTwice.schedule.sends).toEqual(['first']);
    expect(notPlaced(undoneTwice.schedule)).toContain('cal');
  });

  it('starts afresh for each Daily Schedule opened: nothing to undo carries over to another date', () => {
    const edited = change(startEditing(schedule()), (s) => placeCrewMember(s, 'cal', onJob('tower')));
    expect(canUndo(edited)).toBe(true);

    const nextDay = startEditing(schedule({ date: '2026-11-11' }));

    expect(canUndo(nextDay)).toBe(false);
    expect(undo(nextDay).schedule.date).toBe('2026-11-11');
  });
});
