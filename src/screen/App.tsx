import { useEffect, useState } from 'react';
import {
  placeCrewMember,
  returnToNotPlaced,
  type DailySchedule,
  type Destination,
} from '../schedule-rules';
import { seedRoster } from '../seed/seedRoster';
import { seedSchedule } from '../seed/seedSchedule';
import { ScheduleScreen } from './ScheduleScreen';

/**
 * Holds the Daily Schedule being edited and which Crew Member is selected to
 * move. Every change to the schedule goes through `change`, which applies one
 * schedule rule; the screen below only draws and reports clicks.
 */
export function App() {
  const roster = seedRoster;
  const [schedule, setSchedule] = useState<DailySchedule>(seedSchedule);
  const [selectedCrewMemberId, setSelectedCrewMemberId] = useState<string | null>(null);

  /** The one place the Daily Schedule changes. */
  const change = (rule: (schedule: DailySchedule) => DailySchedule) => setSchedule(rule);

  const cancelMove = () => setSelectedCrewMemberId(null);

  const moveSelected = (rule: (schedule: DailySchedule, crewMemberId: string) => DailySchedule) => {
    if (selectedCrewMemberId === null) return;
    const crewMemberId = selectedCrewMemberId;
    change((current) => rule(current, crewMemberId));
    setSelectedCrewMemberId(null);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedCrewMemberId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <ScheduleScreen
      roster={roster}
      schedule={schedule}
      selectedCrewMemberId={selectedCrewMemberId}
      onSelectCrewMember={setSelectedCrewMemberId}
      onCancelMove={cancelMove}
      onPlace={(destination: Destination) =>
        moveSelected((current, crewMemberId) => placeCrewMember(current, crewMemberId, destination))
      }
      onReturnToNotPlaced={() => moveSelected(returnToNotPlaced)}
    />
  );
}
