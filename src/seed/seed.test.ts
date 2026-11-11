import { describe, expect, it } from 'vitest';
import { fullDate, scheduleView } from '../schedule-rules';
import { seedRoster } from './seedRoster';
import { seedSchedule } from './seedSchedule';

// The roster is from the spec; the Daily Schedule is the real sheet for
// Wednesday, November 11, 2026.

const namesWith = (color: string) =>
  seedRoster.crewMembers.filter((member) => member.color === color).map((member) => member.name);

describe('the seed roster', () => {
  it('holds the 20 Crew Members', () => {
    expect(seedRoster.crewMembers).toHaveLength(20);
    expect(new Set(seedRoster.crewMembers.map((member) => member.id)).size).toBe(20);
  });

  it('gives each Crew Member the color from the existing sheets', () => {
    expect(namesWith('grey')).toEqual(['Brody Wilson', 'Ed Stokes', 'Nick Monachino', 'Kris Thomas']);
    expect(namesWith('blue')).toEqual([
      'Josh Syrell',
      'Mike Arena',
      'Brock Phillips',
      'Ethan Casselbury',
      'Rob Harris',
      'Tim Motler',
      'John Briggs',
      'Jason Vine',
    ]);
    expect(namesWith('orange')).toEqual([
      'Evan Kozlowsky',
      'Scott Schreiber',
      'Randy Snyder',
      'Nate Kotvis',
      'Glenn Munger',
    ]);
    expect(namesWith('yellow')).toEqual(['Christian Cirilla', 'Corey Mahoney']);
    expect(namesWith('red')).toEqual(['Greg Black']);
  });

  it('flags exactly the four grey Crew Members as Foreman', () => {
    expect(
      seedRoster.crewMembers.filter((member) => member.foreman).map((member) => member.name),
    ).toEqual(['Brody Wilson', 'Ed Stokes', 'Nick Monachino', 'Kris Thomas']);
  });
});

describe('the seed Daily Schedule', () => {
  const view = scheduleView(seedRoster, seedSchedule);
  const who = (label: string) =>
    view.rows.find((row) => row.label === label)?.who.map((placed) => placed.crewMember.name);

  it('is for Wednesday, November 11, 2026', () => {
    expect(fullDate(view.date)).toBe('Wednesday, November 11, 2026');
  });

  it('shows the five Jobs in order, then Shop, Trucking and Off Work', () => {
    expect(view.rows.map((row) => row.label)).toEqual([
      'J2601 TIUNY',
      'J25008 Los',
      'Bishop Kearney',
      'Cobblestone',
      'Wintergarden',
      'Shop',
      'Trucking',
      'Off Work',
    ]);
  });

  it('puts everyone where the sheet has them, Foremen first on a Job', () => {
    expect(who('J2601 TIUNY')).toEqual(['Brody Wilson', 'Corey Mahoney', 'Rob Harris', 'Mike Arena']);
    expect(who('J25008 Los')).toEqual([
      'Ed Stokes',
      'Nick Monachino',
      'Brock Phillips',
      'Christian Cirilla',
      'John Briggs',
    ]);
    expect(who('Bishop Kearney')).toEqual([]);
    expect(who('Cobblestone')).toEqual(['Kris Thomas', 'Tim Motler', 'Ethan Casselbury']);
    expect(who('Wintergarden')).toEqual([]);
    expect(who('Shop')).toEqual(['Greg Black']);
    expect(who('Trucking')).toEqual(['Randy Snyder']);
    expect(who('Off Work')).toEqual(['Jason Vine', 'Nate Kotvis', 'Josh Syrell', 'Evan Kozlowsky']);
  });

  it('has the Tasks from the sheet', () => {
    const tasks = (label: string) => view.rows.find((row) => row.label === label)?.tasks;
    expect(tasks('J2601 TIUNY')).toEqual(['Catch Basin', 'Pipe']);
    expect(tasks('J25008 Los')).toEqual(['Curb at Hazel Alley (Towers)', 'Take the Dump trailer']);
    expect(tasks('Cobblestone')).toEqual(['Sanitary']);
  });

  it('has Scott Schreiber and Glenn Munger, who are not on the sheet, Not Placed', () => {
    expect(view.notPlaced.map((member) => member.name)).toEqual(['Scott Schreiber', 'Glenn Munger']);
  });

  it('has not been sent', () => {
    expect(seedSchedule.sends).toEqual([]);
  });
});
