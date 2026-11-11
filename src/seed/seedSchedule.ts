/**
 * The seed Daily Schedule: the real sheet for Wednesday, November 11, 2026,
 * as the Scheduler sent it. Who is on each Job, Shop, Trucking and Off Work,
 * in the sheet's order, and each Job's Tasks (the sheet's "* " before a Task
 * was only a bullet). Scott Schreiber and Glenn Munger are not on the sheet,
 * so they are Not Placed; Bishop Kearney and Wintergarden have nobody.
 */

import {
  onJob,
  onStandingRow,
  type DailySchedule,
  type Destination,
  type Placement,
} from '../schedule-rules';

/** Who is where, in the sheet's order (the Foreman is listed first on a Job anyway). */
const sheet: [Destination, string[]][] = [
  [onJob('j2601-tiuny'), ['brody-wilson', 'corey-mahoney', 'rob-harris', 'mike-arena']],
  [
    onJob('j25008-los'),
    ['ed-stokes', 'nick-monachino', 'brock-phillips', 'christian-cirilla', 'john-briggs'],
  ],
  [onJob('cobblestone'), ['kris-thomas', 'tim-motler', 'ethan-casselbury']],
  [onStandingRow('shop'), ['greg-black']],
  [onStandingRow('trucking'), ['randy-snyder']],
  [onStandingRow('off-work'), ['jason-vine', 'nate-kotvis', 'josh-syrell', 'evan-kozlowsky']],
];

const placements: Placement[] = sheet
  .flatMap(([destination, who]) => who.map((crewMemberId) => ({ crewMemberId, destination })))
  .map((placement, index) => ({ ...placement, order: index + 1 }));

export const seedSchedule: DailySchedule = {
  date: '2026-11-11',
  placements,
  tasks: {
    'j2601-tiuny': ['Catch Basin', 'Pipe'],
    'j25008-los': ['Curb at Hazel Alley (Towers)', 'Take the Dump trailer'],
    cobblestone: ['Sanitary'],
  },
  sends: [],
};
