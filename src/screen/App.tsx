import { useEffect, useState } from 'react';
import {
  clearNote,
  placeCrewMember,
  returnToNotPlaced,
  setNote,
  setTasks,
  type DailySchedule,
  type Destination,
} from '../schedule-rules';
import { seedRoster } from '../seed/seedRoster';
import { seedSchedule } from '../seed/seedSchedule';
import { ScheduleScreen } from './ScheduleScreen';

/**
 * Holds the Daily Schedule being edited and which Crew Member is selected to
 * move or to have a Note typed. Every change to the schedule goes through `change`, which applies one
 * schedule rule; the screen below only draws and reports clicks.
 */
export function App() {
  const roster = seedRoster;
  const [schedule, setSchedule] = useState<DailySchedule>(seedSchedule);
  const [selectedCrewMemberId, setSelectedCrewMemberId] = useState<string | null>(null);
  /** True while a Note is being typed for the selected Crew Member. */
  const [editingNote, setEditingNote] = useState(false);

  /** The one place the Daily Schedule changes. */
  const change = (rule: (schedule: DailySchedule) => DailySchedule) => setSchedule(rule);

  const select = (crewMemberId: string | null) => {
    setSelectedCrewMemberId(crewMemberId);
    setEditingNote(false);
  };

  const cancelMove = () => select(null);

  /** Applies one rule to the selected Crew Member (a move or a Note), then lets go of them. */
  const changeSelected = (rule: (schedule: DailySchedule, crewMemberId: string) => DailySchedule) => {
    if (selectedCrewMemberId === null) return;
    const crewMemberId = selectedCrewMemberId;
    change((current) => rule(current, crewMemberId));
    select(null);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelMove();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <ScheduleScreen
      roster={roster}
      schedule={schedule}
      selectedCrewMemberId={selectedCrewMemberId}
      editingNote={editingNote}
      onSelectCrewMember={select}
      onCancelMove={cancelMove}
      onPlace={(destination: Destination) =>
        changeSelected((current, crewMemberId) => placeCrewMember(current, crewMemberId, destination))
      }
      onReturnToNotPlaced={() => changeSelected(returnToNotPlaced)}
      onEditNote={() => setEditingNote(true)}
      onSaveNote={(text) =>
        changeSelected((current, crewMemberId) => setNote(current, crewMemberId, text))
      }
      onClearNote={() => changeSelected(clearNote)}
      onSetTasks={(jobId, text) => change((current) => setTasks(current, jobId, text))}
    />
  );
}
