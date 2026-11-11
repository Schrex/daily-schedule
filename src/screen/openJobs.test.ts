import { describe, expect, it } from 'vitest';
import {
  moveCrewMember,
  NOT_PLACED,
  onJob,
  onStandingRow,
  scheduleView,
  type DailySchedule,
  type Roster,
} from '../schedule-rules';
import { foldedHeading, nextOpenJobs, type OpenJobs } from './openJobs';

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
const start: DailySchedule = {
  date: '2026-11-12',
  placements: [
    { crewMemberId: 'ann', destination: onJob('tower'), order: 1 },
    { crewMemberId: 'bob', destination: onStandingRow('shop'), order: 2 },
  ],
  tasks: { pond: ['Dig the pond'] },
  sends: [],
};

const view = (schedule: DailySchedule) => scheduleView(roster, schedule);
const loaded = (schedule: DailySchedule): OpenJobs =>
  nextOpenJobs(new Set(), { kind: 'rebuild', view: view(schedule) });
/** A change to the Daily Schedule, as the board reports it. */
const changed = (open: OpenJobs, schedule: DailySchedule) =>
  nextOpenJobs(open, { kind: 'changed', view: view(schedule) });

describe('the open set of Jobs', () => {
  it('on load holds every Job with someone on it, and only Jobs', () => {
    expect([...loaded(start)]).toEqual(['job:tower']);
  });

  it('opens a Job as soon as someone is put on it', () => {
    const assigned = moveCrewMember(start, 'bob', onJob('bridge'));
    expect([...changed(loaded(start), assigned)].sort()).toEqual(['job:bridge', 'job:tower']);
  });

  it('opens a Job whose button is tapped, with nobody on it', () => {
    const open = nextOpenJobs(loaded(start), { kind: 'open', jobKey: 'job:pond' });
    expect([...open].sort()).toEqual(['job:pond', 'job:tower']);
  });

  it('keeps a card whose last person is moved off open while editing', () => {
    const emptied = moveCrewMember(start, 'ann', NOT_PLACED);
    const open = changed(loaded(start), emptied);
    expect([...open]).toEqual(['job:tower']);
  });

  it('folds emptied Jobs after Send to crew succeeds', () => {
    const emptied = moveCrewMember(start, 'ann', NOT_PLACED);
    const open = nextOpenJobs(changed(loaded(start), emptied), { kind: 'rebuild', view: view(emptied) });
    expect([...open]).toEqual([]);
  });

  it('folds nothing when Send fails: no event, so the set is as it was', () => {
    const emptied = moveCrewMember(start, 'ann', NOT_PLACED);
    const beforeSend = changed(loaded(start), emptied);
    // A failed or cancelled Send reports nothing; the board redraws with the same schedule.
    expect(changed(beforeSend, emptied)).toBe(beforeSend);
    expect([...beforeSend]).toEqual(['job:tower']);
  });

  it('starts again from the new date when the date is changed', () => {
    const opened = nextOpenJobs(loaded(start), { kind: 'open', jobKey: 'job:pond' });
    const otherDay: DailySchedule = {
      ...start,
      date: '2026-11-13',
      placements: [{ crewMemberId: 'bob', destination: onJob('bridge'), order: 1 }],
    };
    expect([...nextOpenJobs(opened, { kind: 'rebuild', view: view(otherDay) })]).toEqual(['job:bridge']);
  });

  it('returns the same set when nothing opens', () => {
    const open = loaded(start);
    expect(changed(open, start)).toBe(open);
    expect(nextOpenJobs(open, { kind: 'open', jobKey: 'job:tower' })).toBe(open);
  });
});

describe('the heading of the folded Jobs', () => {
  it('says tomorrow when the board is for the day after today', () => {
    expect(foldedHeading('2026-11-12', '2026-11-11')).toBe('No crew tomorrow');
  });

  it('names the weekday otherwise', () => {
    expect(foldedHeading('2026-11-16', '2026-11-13')).toBe('No crew on Monday');
    expect(foldedHeading('2026-11-11', '2026-11-11')).toBe('No crew on Wednesday');
  });

  it('counts across the end of a month', () => {
    expect(foldedHeading('2026-12-01', '2026-11-30')).toBe('No crew tomorrow');
  });
});
