import { describe, expect, it } from 'vitest';
import { fullDate, scheduleView } from '../schedule-rules';
import { seedRoster } from './seedRoster';
import { seedSchedule } from './seedSchedule';

// Only facts given in the spec are asserted here. Which Job each Crew Member is
// on in the seed Daily Schedule is a placeholder and is deliberately not tested.

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
    expect(namesWith('red')).toEqual([]);
    expect(namesWith('gunmetal')).toEqual(['Greg Black']);
  });

  it('flags exactly the four grey Crew Members as Foreman', () => {
    expect(
      seedRoster.crewMembers.filter((member) => member.foreman).map((member) => member.name),
    ).toEqual(['Brody Wilson', 'Ed Stokes', 'Nick Monachino', 'Kris Thomas']);
  });
});

describe('the seed Daily Schedule', () => {
  const view = scheduleView(seedRoster, seedSchedule);

  it('is for Tuesday, November 10, 2026', () => {
    expect(fullDate(view.date)).toBe('Tuesday, November 10, 2026');
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

  it('has nobody on Wintergarden', () => {
    expect(view.rows.find((row) => row.label === 'Wintergarden')?.who).toEqual([]);
  });

  it('has Glenn Munger, and only him, Not Placed', () => {
    expect(view.notPlaced.map((member) => member.name)).toEqual(['Glenn Munger']);
  });

  it('places every other Crew Member exactly once', () => {
    const placedNames = view.rows.flatMap((row) => row.who.map((placed) => placed.crewMember.name));
    expect(placedNames).toHaveLength(19);
    expect(new Set(placedNames).size).toBe(19);
    expect(seedSchedule.placements).toHaveLength(19);
  });

  it('has the Note "1/2 Day" on Evan Kozlowsky', () => {
    const evan = view.rows
      .flatMap((row) => row.who)
      .find((placed) => placed.crewMember.name === 'Evan Kozlowsky');
    expect(evan?.note).toBe('1/2 Day');
  });

  it('has not been sent', () => {
    expect(seedSchedule.sends).toEqual([]);
  });
});
