/**
 * Schedule rules: the one module that owns every rule of the Daily Schedule.
 *
 * Pure: no knowledge of the screen or of storage. Everything is plain data in,
 * plain data out. The screen never applies a rule itself; it draws what this
 * module returns. Vocabulary follows GLOSSARY.md.
 */

// ---------------------------------------------------------------------------
// Data shape
// ---------------------------------------------------------------------------

/** The fixed palette. Color carries no meaning in the rules. */
export const COLORS = ['grey', 'blue', 'orange', 'yellow', 'red'] as const;
export type Color = (typeof COLORS)[number];

export interface CrewMember {
  id: string;
  name: string;
  color: Color;
  foreman: boolean;
}

export interface Job {
  id: string;
  name: string;
  jobNumber?: string;
}

/** Crew Members and Jobs. The order of `jobs` is their display order. */
export interface Roster {
  crewMembers: CrewMember[];
  jobs: Job[];
}

/** The three permanent non-Job places, in the order they are shown. */
export const STANDING_ROWS = ['shop', 'trucking', 'off-work'] as const;
export type StandingRow = (typeof STANDING_ROWS)[number];

export type Destination =
  | { kind: 'job'; jobId: string }
  | { kind: 'standing-row'; standingRow: StandingRow };

/** One Crew Member on one Job or Standing Row for one day. */
export interface Placement {
  crewMemberId: string;
  destination: Destination;
  /** Placement order: lower was placed earlier. */
  order: number;
  note?: string;
  /**
   * Person Tasks: what is only about this Crew Member that day ("Dewatering",
   * "2:00 PM VAC truck training"), shown under their name. Never empty when present.
   */
  personTasks?: string[];
}

/** A calendar day as `YYYY-MM-DD`. */
export type ScheduleDate = string;

export interface DailySchedule {
  date: ScheduleDate;
  /** At most one per Crew Member. A Crew Member with none is Not Placed. */
  placements: Placement[];
  /**
   * Tasks, one Task per entry: a Job's under its id, Shop's and Trucking's
   * under "standing-row:shop" and "standing-row:trucking".
   */
  tasks: Record<string, string[]>;
  /** The send record: each Send, oldest first. */
  sends: SendRecord[];
  /**
   * Day Notes: free-text remarks for everyone that day, in the order added.
   * Missing on a Daily Schedule saved before Day Notes existed.
   */
  dayNotes?: string[];
}

/** One Send: when it happened and exactly what the crew was sent. */
export interface SendRecord {
  /** The time of the Send, an ISO timestamp. */
  sentAt: string;
  /**
   * The crew view that was sent, complete with names, colors and Job labels,
   * so the record still says who was where after the roster changes.
   */
  sent: CrewView;
}

// ---------------------------------------------------------------------------
// Destinations
// ---------------------------------------------------------------------------

export const onJob = (jobId: string): Destination => ({ kind: 'job', jobId });

export const onStandingRow = (standingRow: StandingRow): Destination => ({
  kind: 'standing-row',
  standingRow,
});

const STANDING_ROW_LABELS: Record<StandingRow, string> = {
  shop: 'Shop',
  trucking: 'Trucking',
  'off-work': 'Off Work',
};

export const standingRowLabel = (standingRow: StandingRow): string =>
  STANDING_ROW_LABELS[standingRow];

/** A Job as it is written on the Daily Schedule: "J2601 TIUNY", "Cobblestone". */
export const jobLabel = (job: Job): string =>
  job.jobNumber ? `${job.jobNumber} ${job.name}` : job.name;

// ---------------------------------------------------------------------------
// The Daily Schedule view
// ---------------------------------------------------------------------------

/** One Crew Member as listed in a row's WHO column. */
export interface PlacedCrewMember {
  crewMember: CrewMember;
  note?: string;
  /** Their Person Tasks; left out when they have none. */
  personTasks?: string[];
}

/** One row of the Daily Schedule: a Job or a Standing Row. */
export interface ScheduleRow {
  /** Unique within a view; stable across days for the same Job or Standing Row. */
  key: string;
  destination: Destination;
  label: string;
  tasks: string[];
  who: PlacedCrewMember[];
}

/** Everything the Scheduler's screen draws for one Daily Schedule. */
export interface ScheduleView {
  date: ScheduleDate;
  /** Every Job in roster order (staffed or not), then Shop, Trucking, Off Work. */
  rows: ScheduleRow[];
  /** Crew Members with no Placement, in roster order. */
  notPlaced: CrewMember[];
  /** The Day Notes, in the order added. */
  dayNotes: string[];
}

/**
 * The Daily Schedule as it is drawn. On one that has been sent, a Crew Member
 * or Job since removed from the roster is still shown as it was last sent (for
 * as long as the Placements are there), so sent Daily Schedules keep saying
 * who was where. On one never sent, they are simply gone.
 */
export function scheduleView(roster: Roster, schedule: DailySchedule): ScheduleView {
  const sentRows = lastSend(schedule)?.sent?.rows ?? [];

  const crewMembersById = new Map(
    [...sentRows.flatMap((row) => row.who.map((placed) => placed.crewMember)), ...roster.crewMembers].map(
      (crewMember) => [crewMember.id, crewMember],
    ),
  );

  // Foreman first applies within a Job only; a Standing Row is plain placement order.
  const whoIsOn = (destination: Destination): PlacedCrewMember[] =>
    schedule.placements
      .filter((placement) => destinationKey(placement.destination) === destinationKey(destination))
      .flatMap((placement) => {
        const crewMember = crewMembersById.get(placement.crewMemberId);
        return crewMember ? [{ placement, crewMember }] : [];
      })
      .sort(
        (a, b) =>
          (destination.kind === 'job'
            ? Number(b.crewMember.foreman) - Number(a.crewMember.foreman)
            : 0) || a.placement.order - b.placement.order,
      )
      .map(({ placement, crewMember }) => ({
        crewMember,
        ...(placement.note ? { note: placement.note } : {}),
        ...(placement.personTasks?.length ? { personTasks: [...placement.personTasks] } : {}),
      }));

  const row = (destination: Destination, label: string): ScheduleRow => ({
    key: destinationKey(destination),
    destination,
    label,
    tasks: tasksOn(schedule, destination),
    who: whoIsOn(destination),
  });

  const jobRows = roster.jobs.map((job) => row(onJob(job.id), jobLabel(job)));

  // A Job that was sent but has left the roster goes back where it was sent:
  // above the first Job that came after it in that picture, else after the Jobs.
  sentRows.forEach(({ key, destination, label }, index) => {
    if (destination.kind !== 'job' || jobRows.some((jobRow) => jobRow.key === key)) return;
    const sentRow = row(destination, label);
    if (sentRow.who.length === 0) return;
    const sentAfter = new Set(sentRows.slice(index + 1).map((later) => later.key));
    const next = jobRows.findIndex((jobRow) => sentAfter.has(jobRow.key));
    jobRows.splice(next === -1 ? jobRows.length : next, 0, sentRow);
  });

  const rows: ScheduleRow[] = [
    ...jobRows,
    ...STANDING_ROWS.map((standingRow) =>
      row(onStandingRow(standingRow), standingRowLabel(standingRow)),
    ),
  ];

  const placed = new Set(rows.flatMap((r) => r.who.map((p) => p.crewMember.id)));
  const notPlaced = roster.crewMembers.filter((crewMember) => !placed.has(crewMember.id));

  return { date: schedule.date, rows, notPlaced, dayNotes: dayNotesOf(schedule) };
}

/**
 * A row's title as a card shows it: the name, and a Job's number on its own
 * (shown small beside the count). A Job that has left the roster, or a
 * Standing Row, is its label with no number.
 */
export function cardTitle(roster: Roster, row: ScheduleRow): { name: string; number?: string } {
  const { destination } = row;
  const job =
    destination.kind === 'job'
      ? roster.jobs.find((candidate) => candidate.id === destination.jobId)
      : undefined;
  if (!job) return { name: row.label };
  return job.jobNumber ? { name: job.name, number: job.jobNumber } : { name: job.name };
}

// ---------------------------------------------------------------------------
// Moving a Crew Member
// ---------------------------------------------------------------------------

/**
 * Places a Crew Member on a Job or Standing Row. The new Placement replaces any
 * Placement they had, comes last in placement order, and carries no Note. Their
 * Person Tasks are about them, not the place, so they go along.
 * If they are already there, the same Daily Schedule is returned unchanged.
 */
export function placeCrewMember(
  schedule: DailySchedule,
  crewMemberId: string,
  destination: Destination,
): DailySchedule {
  const current = schedule.placements.find((placement) => placement.crewMemberId === crewMemberId);
  if (current && destinationKey(current.destination) === destinationKey(destination)) {
    return schedule;
  }

  // After everyone already on the schedule, so last in placement order wherever they land.
  const order = Math.max(0, ...schedule.placements.map((placement) => placement.order)) + 1;

  const placement: Placement = current?.personTasks?.length
    ? { crewMemberId, destination, order, personTasks: current.personTasks }
    : { crewMemberId, destination, order };

  return {
    ...schedule,
    placements: [...withoutCrewMember(schedule, crewMemberId), placement],
  };
}

/**
 * Removes a Crew Member's Placement, making them Not Placed. If they are
 * already Not Placed, the same Daily Schedule is returned unchanged.
 */
export function returnToNotPlaced(schedule: DailySchedule, crewMemberId: string): DailySchedule {
  const placements = withoutCrewMember(schedule, crewMemberId);
  return placements.length === schedule.placements.length ? schedule : { ...schedule, placements };
}

/** Where a move can take a Crew Member, besides a Job or Standing Row: back to Not Placed. */
export const NOT_PLACED = 'not-placed';

/** Where a Crew Member can be moved to: a Job or Standing Row, or Not Placed. */
export type MoveTo = Destination | typeof NOT_PLACED;

/**
 * Moves a Crew Member, however the Scheduler did it (a click-click move, a
 * drop): onto a Job or Standing Row (`placeCrewMember`), or to
 * Not Placed (`returnToNotPlaced`). If they are already there, the same Daily
 * Schedule is returned unchanged.
 */
export const moveCrewMember = (
  schedule: DailySchedule,
  crewMemberId: string,
  to: MoveTo,
): DailySchedule =>
  to === NOT_PLACED
    ? returnToNotPlaced(schedule, crewMemberId)
    : placeCrewMember(schedule, crewMemberId, to);

const withoutCrewMember = (schedule: DailySchedule, crewMemberId: string): Placement[] =>
  schedule.placements.filter((placement) => placement.crewMemberId !== crewMemberId);

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

/** The Standing Rows that can have Tasks ("Go get the truck in PA"). Off Work has none. */
export const STANDING_ROWS_WITH_TASKS: readonly StandingRow[] = ['shop', 'trucking'];

/** Whether a Job or Standing Row can have Tasks: every Job, and Shop and Trucking. */
export const canHaveTasks = (destination: Destination): boolean =>
  destination.kind === 'job' || STANDING_ROWS_WITH_TASKS.includes(destination.standingRow);

/**
 * Where a place's Tasks are kept in `DailySchedule.tasks`: a Job's under its
 * id (as they always were), a Standing Row's under "standing-row:shop" and so
 * on, which no Job id can be (they never hold a colon).
 */
const tasksKey = (destination: Destination): string =>
  destination.kind === 'job' ? destination.jobId : destinationKey(destination);

/** The Tasks of a Job or Standing Row on a Daily Schedule; none for a place that cannot have them. */
const tasksOn = (schedule: DailySchedule, destination: Destination): string[] =>
  canHaveTasks(destination) ? (schedule.tasks[tasksKey(destination)] ?? []) : [];

/**
 * Sets the Tasks of a Job, Shop or Trucking from free text, one Task per
 * line. Blank lines and the space around each Task are ignored. If the text
 * gives the Tasks it already has, or the place cannot have Tasks (Off Work),
 * the same Daily Schedule is returned unchanged.
 */
export function setTasks(
  schedule: DailySchedule,
  destination: Destination,
  text: string,
): DailySchedule {
  if (!canHaveTasks(destination)) return schedule;
  const tasks = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const current = tasksOn(schedule, destination);
  if (tasks.length === current.length && tasks.every((task, index) => task === current[index])) {
    return schedule;
  }
  return { ...schedule, tasks: { ...schedule.tasks, [tasksKey(destination)]: tasks } };
}

/** Tasks as the free text `setTasks` reads: one Task per line. */
export const tasksText = (tasks: string[]): string => tasks.join('\n');

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

/**
 * Sets the Note on a Crew Member's Placement from free text; the space around
 * it is ignored, and empty text clears the Note. The Placement itself (where,
 * and its placement order) is kept. If the Placement already has that Note, or
 * the Crew Member is Not Placed, the same Daily Schedule is returned unchanged.
 */
export function setNote(schedule: DailySchedule, crewMemberId: string, text: string): DailySchedule {
  const note = text.trim();
  const current = schedule.placements.find((placement) => placement.crewMemberId === crewMemberId);
  if (!current || (current.note ?? '') === note) return schedule;

  const { note: _oldNote, ...withoutNote } = current;
  const updated: Placement = note ? { ...withoutNote, note } : withoutNote;

  return {
    ...schedule,
    placements: schedule.placements.map((placement) =>
      placement === current ? updated : placement,
    ),
  };
}

// ---------------------------------------------------------------------------
// Person Tasks
// ---------------------------------------------------------------------------

/**
 * Changes the Person Tasks on a Crew Member's Placement with `edit`, which is
 * given them as a fresh list. Nothing happens for a Crew Member who is Not
 * Placed, or when the list comes back the same.
 */
function editPersonTasks(
  schedule: DailySchedule,
  crewMemberId: string,
  edit: (tasks: string[]) => string[],
): DailySchedule {
  const current = schedule.placements.find((placement) => placement.crewMemberId === crewMemberId);
  if (!current) return schedule;
  const before = current.personTasks ?? [];
  const after = edit([...before]);
  if (after.length === before.length && after.every((task, index) => task === before[index])) {
    return schedule;
  }
  const { personTasks: _old, ...rest } = current;
  const updated: Placement = after.length > 0 ? { ...rest, personTasks: after } : rest;
  return {
    ...schedule,
    placements: schedule.placements.map((placement) => (placement === current ? updated : placement)),
  };
}

/**
 * Adds a Person Task, typed as free text, after the Crew Member's others. The
 * space around it is ignored; blank text, or a Crew Member who is Not Placed,
 * changes nothing.
 */
export function addPersonTask(schedule: DailySchedule, crewMemberId: string, text: string): DailySchedule {
  const task = text.trim();
  if (task === '') return schedule;
  return editPersonTasks(schedule, crewMemberId, (tasks) => [...tasks, task]);
}

/**
 * Changes one of a Crew Member's Person Tasks (by its place in their list) to
 * new text. Blank text removes it. An index they have no Task at changes nothing.
 */
export function changePersonTask(
  schedule: DailySchedule,
  crewMemberId: string,
  index: number,
  text: string,
): DailySchedule {
  const task = text.trim();
  return editPersonTasks(schedule, crewMemberId, (tasks) => {
    if (index < 0 || index >= tasks.length) return tasks;
    if (task === '') tasks.splice(index, 1);
    else tasks[index] = task;
    return tasks;
  });
}

/** Removes one of a Crew Member's Person Tasks, by its place in their list. */
export const removePersonTask = (
  schedule: DailySchedule,
  crewMemberId: string,
  index: number,
): DailySchedule => changePersonTask(schedule, crewMemberId, index, '');

// ---------------------------------------------------------------------------
// Day Notes
// ---------------------------------------------------------------------------

const dayNotesOf = (schedule: DailySchedule): string[] => [...(schedule.dayNotes ?? [])];

/** Adds a Day Note after the others. The space around it is ignored; blank text changes nothing. */
export function addDayNote(schedule: DailySchedule, text: string): DailySchedule {
  const note = text.trim();
  if (note === '') return schedule;
  return { ...schedule, dayNotes: [...dayNotesOf(schedule), note] };
}

/**
 * Changes one Day Note (by its place in the list) to new text. Blank text
 * removes it. The same text, or an index with no Day Note, changes nothing.
 */
export function changeDayNote(schedule: DailySchedule, index: number, text: string): DailySchedule {
  const notes = dayNotesOf(schedule);
  const note = text.trim();
  if (index < 0 || index >= notes.length || notes[index] === note) return schedule;
  if (note === '') notes.splice(index, 1);
  else notes[index] = note;
  return { ...schedule, dayNotes: notes };
}

/** Removes one Day Note, by its place in the list. */
export const removeDayNote = (schedule: DailySchedule, index: number): DailySchedule =>
  changeDayNote(schedule, index, '');

// ---------------------------------------------------------------------------
// Edits: every change the Scheduler can make to a Daily Schedule
// ---------------------------------------------------------------------------

/** One change the Scheduler made, as the screen reports it. */
export type ScheduleEdit =
  | { kind: 'move'; crewMemberId: string; to: MoveTo }
  | { kind: 'set-tasks'; destination: Destination; text: string }
  | { kind: 'set-note'; crewMemberId: string; text: string }
  | { kind: 'add-person-task'; crewMemberId: string; text: string }
  | { kind: 'change-person-task'; crewMemberId: string; index: number; text: string }
  | { kind: 'remove-person-task'; crewMemberId: string; index: number }
  | { kind: 'add-day-note'; text: string }
  | { kind: 'change-day-note'; index: number; text: string }
  | { kind: 'remove-day-note'; index: number };

/**
 * The Daily Schedule after one edit, by the rule for it. Returns the same
 * Daily Schedule when the edit changes nothing.
 */
export function applyEdit(schedule: DailySchedule, edit: ScheduleEdit): DailySchedule {
  switch (edit.kind) {
    case 'move':
      return moveCrewMember(schedule, edit.crewMemberId, edit.to);
    case 'set-tasks':
      return setTasks(schedule, edit.destination, edit.text);
    case 'set-note':
      return setNote(schedule, edit.crewMemberId, edit.text);
    case 'add-person-task':
      return addPersonTask(schedule, edit.crewMemberId, edit.text);
    case 'change-person-task':
      return changePersonTask(schedule, edit.crewMemberId, edit.index, edit.text);
    case 'remove-person-task':
      return removePersonTask(schedule, edit.crewMemberId, edit.index);
    case 'add-day-note':
      return addDayNote(schedule, edit.text);
    case 'change-day-note':
      return changeDayNote(schedule, edit.index, edit.text);
    case 'remove-day-note':
      return removeDayNote(schedule, edit.index);
  }
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** The date as shown at the top of the Daily Schedule: "Tuesday, November 10, 2026". */
export function fullDate(date: ScheduleDate): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

const destinationKey = (destination: Destination): string =>
  destination.kind === 'job'
    ? `job:${destination.jobId}`
    : `standing-row:${destination.standingRow}`;

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

/**
 * What the crew is sent: the rows of the picture. No Not Placed list, no
 * controls. A Daily Schedule can be sent at any time: anyone still Not Placed
 * is simply not in it.
 */
export interface CrewView {
  date: ScheduleDate;
  /** True when the picture replaces a different one sent earlier for this date. */
  updated: boolean;
  /** Only the Jobs and Standing Rows with someone on them, in the Scheduler's order. */
  rows: ScheduleRow[];
  /** The Day Notes; left out when there are none (and on Sends from before Day Notes). */
  dayNotes?: string[];
}

/**
 * The crew view of the Daily Schedule as it would be sent now.
 *
 * It is marked UPDATED when the Daily Schedule has been sent before and has
 * changed since. With nothing changed since the last Send it is that Send's
 * picture again, marked (or not) exactly as it was then.
 */
export function crewView(roster: Roster, schedule: DailySchedule): CrewView {
  const view = scheduleView(roster, schedule);
  const rows = view.rows.filter((row) => row.who.length > 0);
  const notes = view.dayNotes.length > 0 ? { dayNotes: view.dayNotes } : {};
  const last = lastSend(schedule);
  if (
    last?.sent &&
    sameData(last.sent.rows, rows) &&
    sameData(last.sent.dayNotes ?? [], view.dayNotes)
  ) {
    return last.sent;
  }
  return { date: schedule.date, updated: last !== undefined, rows, ...notes };
}

/**
 * Marks the Daily Schedule as Sent: adds the crew view that was delivered, and
 * the time (an ISO timestamp), to the send record. The only way a Send is
 * recorded: it is not an edit of the schedule.
 *
 * `sent` is what the crew actually got, which is recorded as it is even if the
 * Daily Schedule has been changed since it was drawn. Sending the same picture
 * as the last Send again is not a new Send, and a picture of another date is
 * not this Daily Schedule's: both return the same Daily Schedule unchanged.
 */
export function markSent(schedule: DailySchedule, sent: CrewView, sentAt: string): DailySchedule {
  if (sent.date !== schedule.date) return schedule;
  const last = lastSend(schedule);
  if (last?.sent && sameData(last.sent, sent)) return schedule;
  return { ...schedule, sends: [...schedule.sends, { sentAt, sent }] };
}

/** The time of the most recent Send (an ISO timestamp), or undefined if never sent. */
export const lastSentAt = (schedule: DailySchedule): string | undefined =>
  lastSend(schedule)?.sentAt;

/**
 * The most recent Send. A Daily Schedule saved before send records held what
 * was sent has only the time of each Send; it is read as sent, picture unknown.
 */
function lastSend(schedule: DailySchedule): (Pick<SendRecord, 'sentAt'> & Partial<SendRecord>) | undefined {
  const last: SendRecord | string | undefined = schedule.sends.at(-1);
  return typeof last === 'string' ? { sentAt: last } : last;
}

/** Whether two pieces of plain data say the same thing, however they were built. */
function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const present = (value: object) =>
    Object.entries(value).filter(([, entry]) => entry !== undefined);
  const entriesOfA = present(a);
  return (
    entriesOfA.length === present(b).length &&
    entriesOfA.every(([key, entry]) => sameData(entry, (b as Record<string, unknown>)[key]))
  );
}

// ---------------------------------------------------------------------------
// The default date
// ---------------------------------------------------------------------------

/** Today's date as the clock on the Scheduler's computer has it. */
export function scheduleDateOf(now: Date): ScheduleDate {
  return toScheduleDate(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** The next weekday after today: Friday, Saturday and Sunday all give Monday. */
export function nextWorkingDay(today: ScheduleDate): ScheduleDate {
  const [year = 0, month = 1, day = 1] = today.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  while (next.getUTCDay() === 0 || next.getUTCDay() === 6) next.setUTCDate(next.getUTCDate() + 1);
  return toScheduleDate(next.getTime());
}

const toScheduleDate = (utcMidnight: number): ScheduleDate =>
  new Date(utcMidnight).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// The Daily Schedule for a date
// ---------------------------------------------------------------------------

/**
 * The Daily Schedule to edit for a date, given the saved Daily Schedules.
 *
 * If one is saved for that date, it is that one, untouched. Otherwise a new one
 * is created from the most recent earlier Daily Schedule: Placements and Tasks
 * are copied, except that Crew Members who were in Off Work become Not Placed,
 * every Note, Person Task and Day Note is dropped, and anything for a Crew Member or Job no longer in the
 * roster is dropped. A new Daily Schedule has no send record. With no earlier
 * Daily Schedule to copy, everyone is Not Placed and there are no Tasks.
 *
 * Nothing in `saved` is changed; saving the result is the caller's business.
 */
export function dailyScheduleFor(
  roster: Roster,
  saved: readonly DailySchedule[],
  date: ScheduleDate,
): DailySchedule {
  const existing = saved.find((schedule) => schedule.date === date);
  if (existing) return existing;

  const previous = saved
    .filter((schedule) => schedule.date < date)
    .reduce<DailySchedule | undefined>(
      (latest, schedule) => (latest && latest.date > schedule.date ? latest : schedule),
      undefined,
    );
  if (!previous) return { date, placements: [], tasks: {}, sends: [] };

  const crewMemberIds = new Set(roster.crewMembers.map((crewMember) => crewMember.id));
  const jobIds = new Set(roster.jobs.map((job) => job.id));
  // Tasks carry over for every Job still on the roster, and for Shop and Trucking.
  const tasksKeys = new Set([
    ...jobIds,
    ...STANDING_ROWS_WITH_TASKS.map((standingRow) => tasksKey(onStandingRow(standingRow))),
  ]);

  const carriesOver = ({ crewMemberId, destination }: Placement): boolean =>
    crewMemberIds.has(crewMemberId) &&
    (destination.kind === 'job'
      ? jobIds.has(destination.jobId)
      : destination.standingRow !== 'off-work');

  return {
    date,
    placements: previous.placements
      .filter(carriesOver)
      .map(({ crewMemberId, destination, order }) => ({ crewMemberId, destination, order })),
    tasks: Object.fromEntries(
      Object.entries(previous.tasks)
        .filter(([key]) => tasksKeys.has(key))
        .map(([key, tasks]) => [key, [...tasks]]),
    ),
    sends: [],
  };
}

// ---------------------------------------------------------------------------
// The roster (managed on the settings page)
// ---------------------------------------------------------------------------

/** What the office fills in for a Crew Member. */
export interface CrewMemberDetails {
  name: string;
  color: Color;
  foreman: boolean;
}

/** Adds a Crew Member at the end of the roster. On any Daily Schedule they are Not Placed. */
export function addCrewMember(roster: Roster, details: CrewMemberDetails): Roster {
  const name = details.name.trim();
  if (name === '') return roster;
  const crewMember: CrewMember = {
    id: newId(name, roster.crewMembers),
    name,
    color: details.color,
    foreman: details.foreman,
  };
  return { ...roster, crewMembers: [...roster.crewMembers, crewMember] };
}

/**
 * Changes a Crew Member's name, color or Foreman flag; whatever is not given
 * stays as it is. Their id, and so their Placements, are untouched. A blank
 * name changes nothing.
 */
export function changeCrewMember(
  roster: Roster,
  crewMemberId: string,
  changes: Partial<CrewMemberDetails>,
): Roster {
  const name = changes.name?.trim();
  if (name === '') return roster;
  return {
    ...roster,
    crewMembers: roster.crewMembers.map((crewMember) =>
      crewMember.id === crewMemberId
        ? {
            id: crewMember.id,
            name: name ?? crewMember.name,
            color: changes.color ?? crewMember.color,
            foreman: changes.foreman ?? crewMember.foreman,
          }
        : crewMember,
    ),
  };
}

/**
 * Removes a Crew Member from the roster. They no longer appear on the Daily
 * Schedule being edited or on later ones; saved Daily Schedules are not rewritten.
 */
export function removeCrewMember(roster: Roster, crewMemberId: string): Roster {
  return {
    ...roster,
    crewMembers: roster.crewMembers.filter((crewMember) => crewMember.id !== crewMemberId),
  };
}

/** What the office fills in for a Job. The job number may be left out or blank. */
export interface JobDetails {
  name: string;
  jobNumber?: string;
}

/** Adds a Job after the other Jobs, above the Standing Rows. A blank name changes nothing. */
export function addJob(roster: Roster, details: JobDetails): Roster {
  const name = details.name.trim();
  if (name === '') return roster;
  const jobNumber = details.jobNumber?.trim();
  const labelled: Omit<Job, 'id'> = jobNumber ? { name, jobNumber } : { name };
  const job: Job = { id: newId(jobLabel({ id: '', ...labelled }), roster.jobs), ...labelled };
  return { ...roster, jobs: [...roster.jobs, job] };
}

/**
 * Changes a Job's name or job number; whatever is not given stays as it is. A
 * blank job number takes the number off. Its id, and so everyone placed on it
 * and its Tasks, are untouched. A blank name changes nothing.
 */
export function changeJob(roster: Roster, jobId: string, changes: Partial<JobDetails>): Roster {
  const name = changes.name?.trim();
  if (name === '') return roster;
  return {
    ...roster,
    jobs: roster.jobs.map((job) => {
      if (job.id !== jobId) return job;
      const jobNumber = changes.jobNumber === undefined ? job.jobNumber : changes.jobNumber.trim();
      const renamed = { id: job.id, name: name ?? job.name };
      return jobNumber ? { ...renamed, jobNumber } : renamed;
    }),
  };
}

/**
 * Removes a Job from the roster. It no longer appears on the Daily Schedule
 * being edited or on later ones, and anyone placed on it is Not Placed; saved
 * Daily Schedules are not rewritten.
 */
export function removeJob(roster: Roster, jobId: string): Roster {
  return { ...roster, jobs: roster.jobs.filter((job) => job.id !== jobId) };
}

/**
 * Moves a Job one place up or down the display order. A Job that is already
 * first cannot move up and one that is last cannot move down: nothing changes.
 */
export function moveJob(roster: Roster, jobId: string, direction: 'up' | 'down'): Roster {
  const from = roster.jobs.findIndex((job) => job.id === jobId);
  const to = direction === 'up' ? from - 1 : from + 1;
  const moved = roster.jobs[from];
  const swapped = roster.jobs[to];
  if (moved === undefined || swapped === undefined) return roster;
  const jobs = [...roster.jobs];
  jobs[from] = swapped;
  jobs[to] = moved;
  return { ...roster, jobs };
}

/**
 * An id not used by anything in the list: the label in lower case with dashes
 * ("Dee Young" gives "dee-young"), then "-2", "-3", ... if that is taken.
 * Once given, an id never changes.
 */
function newId(label: string, existing: { id: string }[]): string {
  const taken = new Set(existing.map((item) => item.id));
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
  let id = base;
  for (let count = 2; taken.has(id); count += 1) id = `${base}-${count}`;
  return id;
}
