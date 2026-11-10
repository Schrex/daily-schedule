import type { Color, CrewMember, Roster } from '../schedule-rules';

/**
 * The seed roster: the real 20 Crew Members with their colors and Foreman
 * flags, and the five Jobs in display order, exactly as given in the spec
 * (issue #1, "Seed data").
 */

const idFor = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const crew = (color: Color, foreman: boolean, names: string[]): CrewMember[] =>
  names.map((name) => ({ id: idFor(name), name, color, foreman }));

export const seedRoster: Roster = {
  crewMembers: [
    ...crew('grey', true, ['Brody Wilson', 'Ed Stokes', 'Nick Monachino', 'Kris Thomas']),
    ...crew('blue', false, [
      'Josh Syrell',
      'Mike Arena',
      'Brock Phillips',
      'Ethan Casselbury',
      'Rob Harris',
      'Tim Motler',
      'John Briggs',
      'Jason Vine',
    ]),
    ...crew('orange', false, [
      'Evan Kozlowsky',
      'Scott Schreiber',
      'Randy Snyder',
      'Nate Kotvis',
      'Glenn Munger',
    ]),
    ...crew('yellow', false, ['Christian Cirilla', 'Corey Mahoney']),
    ...crew('red', false, ['Greg Black']),
  ],
  jobs: [
    { id: 'j2601-tiuny', name: 'TIUNY', jobNumber: 'J2601' },
    { id: 'j25008-los', name: 'Los', jobNumber: 'J25008' },
    { id: 'bishop-kearney', name: 'Bishop Kearney' },
    { id: 'cobblestone', name: 'Cobblestone' },
    { id: 'wintergarden', name: 'Wintergarden' },
  ],
};
