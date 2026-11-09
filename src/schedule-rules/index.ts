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
}

/** A calendar day as `YYYY-MM-DD`. */
export type ScheduleDate = string;

export interface DailySchedule {
  date: ScheduleDate;
  /** At most one per Crew Member. A Crew Member with none is Not Placed. */
  placements: Placement[];
  /** Tasks per Job id, one Task per entry. */
  tasks: Record<string, string[]>;
  /** The send record: ISO timestamps of each Send, oldest first. */
  sends: string[];
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
}

export function scheduleView(roster: Roster, schedule: DailySchedule): ScheduleView {
  const crewMembersById = new Map(roster.crewMembers.map((member) => [member.id, member]));

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
      .map(({ placement, crewMember }) =>
        placement.note ? { crewMember, note: placement.note } : { crewMember },
      );

  const row = (destination: Destination, label: string, tasks: string[]): ScheduleRow => ({
    key: destinationKey(destination),
    destination,
    label,
    tasks,
    who: whoIsOn(destination),
  });

  const rows: ScheduleRow[] = [
    ...roster.jobs.map((job) => row(onJob(job.id), jobLabel(job), schedule.tasks[job.id] ?? [])),
    ...STANDING_ROWS.map((standingRow) =>
      row(onStandingRow(standingRow), standingRowLabel(standingRow), []),
    ),
  ];

  const placed = new Set(rows.flatMap((r) => r.who.map((p) => p.crewMember.id)));
  const notPlaced = roster.crewMembers.filter((crewMember) => !placed.has(crewMember.id));

  return { date: schedule.date, rows, notPlaced };
}

// ---------------------------------------------------------------------------
// Moving a Crew Member
// ---------------------------------------------------------------------------

/**
 * Places a Crew Member on a Job or Standing Row. The new Placement replaces any
 * Placement they had, comes last in placement order, and carries no Note.
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

  return {
    ...schedule,
    placements: [...withoutCrewMember(schedule, crewMemberId), { crewMemberId, destination, order }],
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

const withoutCrewMember = (schedule: DailySchedule, crewMemberId: string): Placement[] =>
  schedule.placements.filter((placement) => placement.crewMemberId !== crewMemberId);

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

/**
 * Sets a Job's Tasks from free text, one Task per line. Blank lines and the
 * space around each Task are ignored. If the text gives the Tasks the Job
 * already has, the same Daily Schedule is returned unchanged.
 */
export function setTasks(schedule: DailySchedule, jobId: string, text: string): DailySchedule {
  const tasks = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const current = schedule.tasks[jobId] ?? [];
  if (tasks.length === current.length && tasks.every((task, index) => task === current[index])) {
    return schedule;
  }
  return { ...schedule, tasks: { ...schedule.tasks, [jobId]: tasks } };
}

/** A Job's Tasks as the free text `setTasks` reads: one Task per line. */
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

/**
 * Clears the Note on a Crew Member's Placement. If there is no Note, the same
 * Daily Schedule is returned unchanged.
 */
export const clearNote = (schedule: DailySchedule, crewMemberId: string): DailySchedule =>
  setNote(schedule, crewMemberId, '');

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
