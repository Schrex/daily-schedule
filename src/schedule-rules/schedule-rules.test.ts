import { describe, expect, it } from 'vitest';
import {
  dailyScheduleFor,
  clearNote,
  fullDate,
  nextWorkingDay,
  scheduleDateOf,
  onJob,
  onStandingRow,
  moveCrewMember,
  NOT_PLACED,
  placeCrewMember,
  returnToNotPlaced,
  scheduleView,
  setNote,
  setTasks,
  tasksText,
  crewView,
  lastSentAt,
  markSent,
  sendCheck,
  addCrewMember,
  addJob,
  changeCrewMember,
  changeJob,
  moveJob,
  removeCrewMember,
  removeJob,
  addPersonTask,
  changePersonTask,
  removePersonTask,
  addDayNote,
  changeDayNote,
  removeDayNote,
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

const whoIsOn = (label: string, daily: DailySchedule, from: Roster = roster) =>
  scheduleView(from, daily)
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

describe('moving a Crew Member', () => {
  const before = schedule({
    placements: [placement('ann', onJob('tower'), 1), placement('bob', onJob('tower'), 2)],
  });

  it('places them on the Job or Standing Row they are moved to, last in placement order', () => {
    const toShop = moveCrewMember(before, 'ann', onStandingRow('shop'));
    expect(whoIsOn('Shop', toShop)).toEqual(['ann']);
    expect(whoIsOn('J100 Tower', toShop)).toEqual(['bob']);

    const cal = moveCrewMember(before, 'cal', onJob('tower'));
    expect(whoIsOn('J100 Tower', cal)).toEqual(['ann', 'bob', 'cal']);
  });

  it('removes their Placement when they are moved to Not Placed', () => {
    const moved = moveCrewMember(before, 'ann', NOT_PLACED);

    expect(whoIsOn('J100 Tower', moved)).toEqual(['bob']);
    expect(notPlaced(moved)).toEqual(['ann', 'fay', 'cal']);
  });

  it('changes nothing when they are moved to where they already are', () => {
    expect(moveCrewMember(before, 'ann', onJob('tower'))).toBe(before);
    expect(moveCrewMember(before, 'cal', NOT_PLACED)).toBe(before);
  });
});

const tasksOf = (label: string, daily: DailySchedule): string[] =>
  scheduleView(roster, daily).rows.find((row) => row.label === label)?.tasks ?? [];

describe("setting a Job's Tasks", () => {
  it('makes one Task of each line of the text', () => {
    const edited = setTasks(schedule(), onJob('tower'), 'Strip topsoil\nRough grade building pad');

    expect(tasksOf('J100 Tower', edited)).toEqual(['Strip topsoil', 'Rough grade building pad']);
  });

  it('ignores blank lines and the space around each Task', () => {
    const edited = setTasks(schedule(), onJob('tower'), '\n  Strip topsoil  \r\n\n   \nSet curb\n');

    expect(tasksOf('J100 Tower', edited)).toEqual(['Strip topsoil', 'Set curb']);
  });

  it('replaces the Tasks the Job had, and leaves other Jobs alone', () => {
    const before = schedule({ tasks: { tower: ['Strip topsoil'], bridge: ['Set curb'] } });

    const edited = setTasks(before, onJob('tower'), 'Pour footings');

    expect(tasksOf('J100 Tower', edited)).toEqual(['Pour footings']);
    expect(tasksOf('Bridge', edited)).toEqual(['Set curb']);
  });

  it('leaves the Job with no Tasks when the text is empty', () => {
    const before = schedule({ tasks: { tower: ['Strip topsoil'] } });

    expect(tasksOf('J100 Tower', setTasks(before, onJob('tower'), '  \n'))).toEqual([]);
  });

  it('changes nothing when the text gives the Tasks the Job already has', () => {
    const before = schedule({ tasks: { tower: ['Strip topsoil', 'Set curb'] } });

    expect(setTasks(before, onJob('tower'), 'Strip topsoil\nSet curb\n')).toBe(before);
    expect(setTasks(before, onJob('bridge'), '')).toBe(before);
  });

  it('leaves the Daily Schedule it was given untouched', () => {
    const before = schedule({ tasks: { tower: ['Strip topsoil'] } });

    setTasks(before, onJob('tower'), 'Pour footings');

    expect(before.tasks).toEqual({ tower: ['Strip topsoil'] });
  });
});

describe('Tasks for Shop and Trucking', () => {
  it('can be set and shown on Shop and Trucking, without touching any Job', () => {
    const before = schedule({ tasks: { tower: ['Strip topsoil'] } });

    const shop = setTasks(before, onStandingRow('shop'), 'Service the loader');
    const both = setTasks(shop, onStandingRow('trucking'), 'Go get the truck in PA');

    expect(tasksOf('Shop', both)).toEqual(['Service the loader']);
    expect(tasksOf('Trucking', both)).toEqual(['Go get the truck in PA']);
    expect(tasksOf('J100 Tower', both)).toEqual(['Strip topsoil']);
  });

  it('cannot be set on Off Work', () => {
    const before = schedule();

    expect(setTasks(before, onStandingRow('off-work'), 'Vacation')).toBe(before);
    expect(tasksOf('Off Work', before)).toEqual([]);
  });

  it('are never mistaken for a Job with the same name', () => {
    const withShopJob = { ...roster, jobs: [...roster.jobs, { id: 'shop', name: 'Shop Job' }] };
    const edited = setTasks(schedule(), onStandingRow('shop'), 'Service the loader');

    const view = scheduleView(withShopJob, edited);
    expect(view.rows.find((row) => row.label === 'Shop Job')?.tasks).toEqual([]);
    expect(view.rows.find((row) => row.label === 'Shop')?.tasks).toEqual(['Service the loader']);
  });

  it('carry over to the next day, as a Job\'s do', () => {
    const tuesday = setTasks(schedule({ date: '2026-11-10' }), onStandingRow('trucking'), 'Haul stone');

    expect(tasksOf('Trucking', dailyScheduleFor(roster, [tuesday], '2026-11-11'))).toEqual([
      'Haul stone',
    ]);
  });
});

describe('the text of a Job\'s Tasks', () => {
  it('is one Task per line, and gives the same Tasks back when set again', () => {
    const before = schedule({ tasks: { tower: ['Strip topsoil', 'Set curb'] } });

    expect(tasksText(tasksOf('J100 Tower', before))).toBe('Strip topsoil\nSet curb');
    expect(setTasks(before, onJob('tower'), tasksText(tasksOf('J100 Tower', before)))).toBe(before);
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
// Send
// ---------------------------------------------------------------------------

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

/** Send as the screen does it: take the crew view, deliver it, then record it as sent. */
const send = (toSend: DailySchedule, sentAt: string, sendRoster: Roster = roster): DailySchedule =>
  markSent(toSend, crewView(sendRoster, toSend), sentAt);

describe('marking a Daily Schedule as Sent', () => {
  it('has never been sent to begin with', () => {
    expect(lastSentAt(everyonePlaced())).toBeUndefined();
  });

  it('adds the Send to the send record with its time, keeping earlier Sends', () => {
    const once = send(everyonePlaced(), '2026-11-09T23:05:00.000Z');
    const changed = placeCrewMember(once, 'bob', onStandingRow('trucking'));
    const twice = send(changed, '2026-11-09T23:40:00.000Z');

    expect(once.sends.map((record) => record.sentAt)).toEqual(['2026-11-09T23:05:00.000Z']);
    expect(twice.sends.map((record) => record.sentAt)).toEqual([
      '2026-11-09T23:05:00.000Z',
      '2026-11-09T23:40:00.000Z',
    ]);
    expect(lastSentAt(twice)).toBe('2026-11-09T23:40:00.000Z');
  });

  it('changes nothing else, and leaves the Daily Schedule it was given untouched', () => {
    const before = everyonePlaced({ tasks: { tower: ['Pour footings'] } });

    const sent = send(before, '2026-11-09T23:05:00.000Z');

    expect(before.sends).toEqual([]);
    expect(scheduleView(roster, sent)).toEqual(scheduleView(roster, before));
  });

  it('does not count a Send of the same picture again as a new Send', () => {
    const once = send(everyonePlaced(), '2026-11-09T23:05:00.000Z');

    const again = send(once, '2026-11-09T23:06:00.000Z');

    expect(again).toBe(once);
    expect(lastSentAt(again)).toBe('2026-11-09T23:05:00.000Z');
  });
});

describe('the send record', () => {
  const sentTuesday = () =>
    send(
      everyonePlaced({
        placements: [
          placement('ann', onJob('tower'), 1, '1/2 Day'),
          placement('fay', onJob('tower'), 2),
          placement('bob', onStandingRow('shop'), 3),
          placement('cal', onStandingRow('off-work'), 4),
        ],
        tasks: { tower: ['Pour footings'] },
      }),
      '2026-11-09T23:05:00.000Z',
    );

  it('keeps what was sent: the date, each row with its label and Tasks, names, colors and Notes', () => {
    const [record] = sentTuesday().sends;

    expect(record?.sent.date).toBe('2026-11-10');
    expect(
      record?.sent.rows.map((row) => [
        row.label,
        row.tasks,
        row.who.map(({ crewMember, note }) => [crewMember.name, crewMember.color, note]),
      ]),
    ).toEqual([
      ['J100 Tower', ['Pour footings'], [['fay', 'grey', undefined], ['ann', 'blue', '1/2 Day']]],
      ['Shop', [], [['bob', 'blue', undefined]]],
      ['Off Work', [], [['cal', 'orange', undefined]]],
    ]);
  });

  it('records the picture the crew got, even if the Daily Schedule changed while it was being sent', () => {
    const pressed = everyonePlaced();
    const delivered = crewView(roster, pressed);
    const changedMeanwhile = placeCrewMember(pressed, 'bob', onStandingRow('trucking'));

    const sent = markSent(changedMeanwhile, delivered, '2026-11-09T23:05:00.000Z');

    expect(whoIsOn('Trucking', sent)).toEqual(['bob']);
    expect(sent.sends[0]?.sent.rows.map((row) => row.label)).toEqual(['J100 Tower', 'Shop', 'Off Work']);
    expect(crewView(roster, sent).updated).toBe(true);
  });

  it('does not record a picture of another date', () => {
    const wednesday = everyonePlaced({ date: '2026-11-11' });

    expect(markSent(wednesday, crewView(roster, everyonePlaced()), '2026-11-09T23:05:00.000Z')).toBe(
      wednesday,
    );
  });

  it('still shows a sent Daily Schedule with a Crew Member and a Job since removed from the roster', () => {
    const sent = sentTuesday();
    const later = removeJob(removeCrewMember(removeCrewMember(roster, 'ann'), 'bob'), 'tower');

    const view = scheduleView(later, sent);

    expect(view.rows.map((row) => row.label)).toEqual([
      'Bridge',
      'J100 Tower',
      'Shop',
      'Trucking',
      'Off Work',
    ]);
    const tower = view.rows.find((row) => row.label === 'J100 Tower');
    expect(tower?.tasks).toEqual(['Pour footings']);
    expect(tower?.who.map(({ crewMember, note }) => [crewMember.name, crewMember.color, note])).toEqual([
      ['fay', 'grey', undefined],
      ['ann', 'blue', '1/2 Day'],
    ]);
    expect(whoIsOn('Shop', sent, later)).toEqual(['bob']);
    expect(view.notPlaced).toEqual([]);
  });

  it('sends the same picture again, not UPDATED, after a Crew Member and a Job on it are removed', () => {
    const sent = send(
      everyonePlaced({
        placements: [
          placement('ann', onJob('tower'), 1),
          placement('fay', onJob('bridge'), 2),
          placement('bob', onStandingRow('shop'), 3),
          placement('cal', onStandingRow('off-work'), 4),
        ],
      }),
      '2026-11-09T23:05:00.000Z',
    );
    const later = removeJob(removeCrewMember(roster, 'ann'), 'tower');

    expect(scheduleView(later, sent).rows.map((row) => row.label).slice(0, 2)).toEqual([
      'J100 Tower',
      'Bridge',
    ]);

    expect(crewView(later, sent).updated).toBe(false);
    expect(send(sent, '2026-11-10T08:00:00.000Z', later)).toBe(sent);
  });

  it('drops a removed Crew Member and Job from a Daily Schedule that was never sent', () => {
    const unsent = everyonePlaced({ tasks: { tower: ['Pour footings'] } });
    const later = removeJob(removeCrewMember(roster, 'bob'), 'tower');

    const view = scheduleView(later, unsent);

    expect(view.rows.map((row) => row.label)).toEqual(['Bridge', 'Shop', 'Trucking', 'Off Work']);
    expect(whoIsOn('Shop', unsent, later)).toEqual([]);
  });

  it('reads a Daily Schedule saved when the send record held only times: sent, picture unknown', () => {
    const old = everyonePlaced({
      sends: ['2026-11-09T23:05:00.000Z'] as unknown as DailySchedule['sends'],
    });

    expect(lastSentAt(old)).toBe('2026-11-09T23:05:00.000Z');
    expect(scheduleView(roster, old)).toEqual(scheduleView(roster, everyonePlaced()));
    expect(crewView(roster, old).updated).toBe(true);

    const resent = send(old, '2026-11-09T23:40:00.000Z');
    expect(lastSentAt(resent)).toBe('2026-11-09T23:40:00.000Z');
    expect(send(resent, '2026-11-09T23:41:00.000Z')).toBe(resent);
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

  it('is marked UPDATED when sent again after a change', () => {
    const sentOnce = send(everyonePlaced(), '2026-11-09T23:05:00.000Z');

    const changed = setNote(sentOnce, 'ann', '1/2 Day');

    expect(crewView(roster, changed).updated).toBe(true);
  });

  it('is the same picture, not UPDATED, when sent again with nothing changed', () => {
    const sentOnce = send(everyonePlaced(), '2026-11-09T23:05:00.000Z');

    expect(crewView(roster, sentOnce).updated).toBe(false);
    expect(crewView(roster, send(sentOnce, '2026-11-09T23:06:00.000Z')).updated).toBe(false);
  });

  it('stays UPDATED when an UPDATED picture is sent again with nothing changed', () => {
    const sentOnce = send(everyonePlaced(), '2026-11-09T23:05:00.000Z');
    const sentTwice = send(setNote(sentOnce, 'ann', '1/2 Day'), '2026-11-09T23:40:00.000Z');

    expect(crewView(roster, sentTwice).updated).toBe(true);
    expect(send(sentTwice, '2026-11-09T23:41:00.000Z')).toBe(sentTwice);
  });

  it('tells a changed Daily Schedule from the one sent after it was saved and read back', () => {
    const reloaded = JSON.parse(
      JSON.stringify(send(everyonePlaced(), '2026-11-09T23:05:00.000Z')),
    ) as DailySchedule;

    expect(crewView(roster, reloaded).updated).toBe(false);
    expect(send(reloaded, '2026-11-09T23:06:00.000Z')).toBe(reloaded);
    expect(crewView(roster, clearNote(setNote(reloaded, 'ann', 'x'), 'ann')).updated).toBe(false);
    expect(crewView(roster, placeCrewMember(reloaded, 'bob', onJob('bridge'))).updated).toBe(true);
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
    sends: [{ sentAt: '2026-11-09T22:00:00.000Z', sent: { date: '2026-11-10', updated: false, rows: [] } }],
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
      sends: [{ sentAt: '2026-11-10T22:00:00.000Z', sent: { date: '2026-11-11', updated: false, rows: [] } }],
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


// ---------------------------------------------------------------------------
// The roster, as managed on the settings page
// ---------------------------------------------------------------------------

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

describe('changing a Job', () => {
  it('changes its name and job number and keeps everyone placed on it', () => {
    const changed = changeJob(roster, 'bridge', { name: ' Footbridge ', jobNumber: ' J200 ' });

    expect(jobLabels(changed)).toEqual(['J100 Tower', 'J200 Footbridge']);
    const daily = schedule({ placements: [placement('ann', onJob('bridge'), 1)] });
    const row = scheduleView(changed, daily).rows.find((each) => each.label === 'J200 Footbridge');
    expect(row?.who.map((placed) => placed.crewMember.id)).toEqual(['ann']);
  });

  it('takes the job number off when it is blank', () => {
    const changed = changeJob(roster, 'tower', { jobNumber: '  ' });

    expect(jobLabels(changed)).toEqual(['Tower', 'Bridge']);
    expect(changed.jobs[0]).toEqual({ id: 'tower', name: 'Tower' });
  });

  it('changes only what is given', () => {
    expect(jobLabels(changeJob(roster, 'tower', { name: 'Spire' }))).toEqual([
      'J100 Spire',
      'Bridge',
    ]);
  });

  it('changes nothing when the name is blank', () => {
    expect(changeJob(roster, 'tower', { name: ' ' })).toBe(roster);
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

describe('Person Tasks', () => {
  const onTower = () => schedule({ placements: [placement('ann', onJob('tower'), 1)] });
  const whoOnTower = (s: DailySchedule) =>
    scheduleView(roster, s).rows.find((row) => row.label === 'J100 Tower')?.who;

  it('are added under the name, in the order typed, without the space around them', () => {
    const s = addPersonTask(addPersonTask(onTower(), 'ann', ' Dewatering '), 'ann', '2:00 PM VAC truck training');
    expect(whoOnTower(s)?.[0]?.personTasks).toEqual(['Dewatering', '2:00 PM VAC truck training']);
  });

  it('are left out of the view when there are none', () => {
    expect(whoOnTower(onTower())?.[0]).not.toHaveProperty('personTasks');
  });

  it('cannot be added blank, or for someone Not Placed', () => {
    const s = onTower();
    expect(addPersonTask(s, 'ann', '   ')).toBe(s);
    expect(addPersonTask(s, 'bob', 'Dewatering')).toBe(s);
  });

  it('can be changed, and a blank change or a removal takes the Task away', () => {
    const s = addPersonTask(addPersonTask(onTower(), 'ann', 'A'), 'ann', 'B');
    expect(whoOnTower(changePersonTask(s, 'ann', 0, 'C'))?.[0]?.personTasks).toEqual(['C', 'B']);
    expect(whoOnTower(changePersonTask(s, 'ann', 1, ' '))?.[0]?.personTasks).toEqual(['A']);
    const none = removePersonTask(removePersonTask(s, 'ann', 0), 'ann', 0);
    expect(none.placements[0]).not.toHaveProperty('personTasks');
    expect(changePersonTask(s, 'ann', 5, 'X')).toBe(s);
    expect(changePersonTask(s, 'ann', 0, 'A')).toBe(s);
  });

  it('go along when the Crew Member is moved, while the Note does not', () => {
    const s = setNote(addPersonTask(onTower(), 'ann', 'Dewatering'), 'ann', '1/2 Day');
    const moved = placeCrewMember(s, 'ann', onJob('bridge'));
    const placed = scheduleView(roster, moved).rows.find((row) => row.label === 'Bridge')?.who[0];
    expect(placed).toEqual({ crewMember: roster.crewMembers[0], personTasks: ['Dewatering'] });
  });

  it('are gone when the Crew Member goes back to Not Placed', () => {
    const s = returnToNotPlaced(addPersonTask(onTower(), 'ann', 'Dewatering'), 'ann');
    expect(placeCrewMember(s, 'ann', onJob('tower')).placements[0]).not.toHaveProperty('personTasks');
  });

  it('do not carry over to the next Daily Schedule', () => {
    const s = addPersonTask(onTower(), 'ann', 'Dewatering');
    const next = dailyScheduleFor(roster, [s], '2026-11-11');
    expect(next.placements[0]).not.toHaveProperty('personTasks');
  });
});

describe('Day Notes', () => {
  it('are none on a Daily Schedule saved before they existed', () => {
    expect(scheduleView(roster, schedule()).dayNotes).toEqual([]);
  });

  it('are added in order, without the space around them; blank text changes nothing', () => {
    const s = addDayNote(addDayNote(schedule(), ' First '), 'Second');
    expect(scheduleView(roster, s).dayNotes).toEqual(['First', 'Second']);
    expect(addDayNote(s, '  ')).toBe(s);
  });

  it('can be changed or removed', () => {
    const s = addDayNote(addDayNote(schedule(), 'A'), 'B');
    expect(changeDayNote(s, 1, 'C').dayNotes).toEqual(['A', 'C']);
    expect(changeDayNote(s, 0, '').dayNotes).toEqual(['B']);
    expect(removeDayNote(s, 1).dayNotes).toEqual(['A']);
    expect(changeDayNote(s, 0, 'A')).toBe(s);
    expect(changeDayNote(s, 4, 'X')).toBe(s);
  });

  it('do not carry over to the next Daily Schedule', () => {
    expect(dailyScheduleFor(roster, [addDayNote(schedule(), 'A')], '2026-11-11').dayNotes).toBeUndefined();
  });

  it('are sent to the crew, and a change to them marks the picture UPDATED', () => {
    const noted = addDayNote(everyonePlaced(), 'Bring boots');
    expect(crewView(roster, noted).dayNotes).toEqual(['Bring boots']);
    expect(crewView(roster, everyonePlaced())).not.toHaveProperty('dayNotes');
    const sent = send(noted, '2026-11-09T23:05:00.000Z');
    expect(crewView(roster, sent).updated).toBe(false);
    expect(crewView(roster, changeDayNote(sent, 0, 'Bring gloves')).updated).toBe(true);
  });
});
