/* ===========================================================================
 * PLACEHOLDER  --  PLACEHOLDER  --  PLACEHOLDER
 *
 * The Placements and Tasks below are INVENTED. The real Tuesday, November 10,
 * 2026 Excel sheet was not available when this was written. They MUST BE
 * REPLACED from the real sheet before the Scheduler's first evening.
 *
 * Only these facts are real (from the spec, issue #1):
 *   - the date: Tuesday, November 10, 2026
 *   - Glenn Munger is Not Placed (he has no Placement here)
 *   - Wintergarden has nobody on it
 *   - Evan Kozlowsky has the Note "1/2 Day"
 *   - "Strip topsoil" is an example Task
 *
 * Everything else (who is on which Job or Standing Row, the placement order,
 * and every other Task) is a plausible guess. The roster is real and lives in
 * seedRoster.ts.
 * ======================================================================== */

import {
  onJob,
  onStandingRow,
  type DailySchedule,
  type Destination,
  type Placement,
} from '../schedule-rules';

/** [Crew Member id, Note?] in placement order. */
type Who = [crewMemberId: string, note?: string];

// PLACEHOLDER: invented, except Evan Kozlowsky's Note and Wintergarden being empty.
const placeholderPlacements: [Destination, Who[]][] = [
  [
    onJob('j2601-tiuny'),
    [
      ['brody-wilson'],
      ['josh-syrell'],
      ['mike-arena'],
      ['evan-kozlowsky', '1/2 Day'],
      ['christian-cirilla'],
    ],
  ],
  [
    onJob('j25008-los'),
    [['ed-stokes'], ['brock-phillips'], ['ethan-casselbury'], ['scott-schreiber']],
  ],
  [
    onJob('bishop-kearney'),
    [['nick-monachino'], ['rob-harris'], ['randy-snyder'], ['corey-mahoney']],
  ],
  [onJob('cobblestone'), [['kris-thomas'], ['tim-motler'], ['nate-kotvis']]],
  // Wintergarden: nobody. Glenn Munger: Not Placed.
  [onStandingRow('shop'), [['john-briggs']]],
  [onStandingRow('trucking'), [['jason-vine']]],
  [onStandingRow('off-work'), [['greg-black']]],
];

const placements: Placement[] = placeholderPlacements
  .flatMap(([destination, who]) =>
    who.map(([crewMemberId, note]) => ({ crewMemberId, destination, note })),
  )
  .map(({ crewMemberId, destination, note }, index) => ({
    crewMemberId,
    destination,
    order: index + 1,
    ...(note ? { note } : {}),
  }));

export const seedSchedule: DailySchedule = {
  date: '2026-11-10',
  placements,
  // PLACEHOLDER: invented Tasks ("Strip topsoil" is the spec's example).
  tasks: {
    'j2601-tiuny': ['Strip topsoil', 'Rough grade building pad'],
    'j25008-los': ['Install storm pipe'],
    'bishop-kearney': ['Backfill foundation', 'Fine grade parking lot'],
    cobblestone: ['Set curb'],
  },
  sends: [],
};
