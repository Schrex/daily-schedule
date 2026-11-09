import { useEffect, useState } from 'react';
import {
  placeCrewMember,
  returnToNotPlaced,
  type DailySchedule,
  type Destination,
  type ScheduleDate,
} from '../schedule-rules';
import { openDate, type Opened, type ScheduleStore } from '../storage';
import { ChangeDate } from './ChangeDate';
import { ScheduleScreen } from './ScheduleScreen';

/**
 * Holds the Daily Schedule being edited and which Crew Member is selected to
 * move. Every change to the schedule goes through `change`, which applies one
 * schedule rule and saves the result; the screen below only draws and reports
 * clicks. `opened` is what the store held when the page loaded.
 */
export function App({ store, opened }: { store: ScheduleStore; opened: Opened }) {
  const roster = opened.roster;
  const [schedule, setSchedule] = useState<DailySchedule>(opened.schedule);
  const [selectedCrewMemberId, setSelectedCrewMemberId] = useState<string | null>(null);

  /** The one place the Daily Schedule changes. Every change is saved by itself. */
  const change = (rule: (schedule: DailySchedule) => DailySchedule) => {
    const next = rule(schedule);
    if (next === schedule) return;
    setSchedule(next);
    store.saveSchedule(next).catch((error) => console.error('Could not save the Daily Schedule', error));
  };

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

  /** Opens the Daily Schedule for another date, creating it if there is none. */
  const changeDate = (date: ScheduleDate) => {
    setSelectedCrewMemberId(null);
    openDate(store, roster, date)
      .then(setSchedule)
      .catch((error) => console.error('Could not open the Daily Schedule', error));
  };

  return (
    <>
    <ChangeDate date={schedule.date} onChangeDate={changeDate} />
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
    </>
  );
}
