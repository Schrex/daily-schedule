import { useEffect, useState } from 'react';
import {
  canUndo,
  change as changeEditing,
  clearNote,
  placeCrewMember,
  returnToNotPlaced,
  setNote,
  setTasks,
  startEditing,
  undo,
  type DailySchedule,
  type Destination,
  type Editing,
  type ScheduleDate,
} from '../schedule-rules';
import { openDate, type Opened, type ScheduleStore } from '../storage';
import { ChangeDate } from './ChangeDate';
import { ScheduleScreen } from './ScheduleScreen';

/**
 * Holds the Daily Schedule being edited (with what Undo can step back through,
 * for this sitting only) and which Crew Member is selected to move or to have
 * a Note typed. Every change to the schedule goes through `change`, which
 * applies one schedule rule and saves the result; Undo saves what it puts
 * back the same way. The screen below only draws and reports clicks. `opened`
 * is what the store held when the page loaded.
 */
export function App({ store, opened }: { store: ScheduleStore; opened: Opened }) {
  const roster = opened.roster;
  const [editing, setEditing] = useState<Editing>(() => startEditing(opened.schedule));
  const schedule = editing.schedule;
  const [selectedCrewMemberId, setSelectedCrewMemberId] = useState<string | null>(null);
  /** True while a Note is being typed for the selected Crew Member. */
  const [editingNote, setEditingNote] = useState(false);

  /** The one place the Daily Schedule changes. Every change is saved by itself. */
  const change = (rule: (schedule: DailySchedule) => DailySchedule) =>
    keep(changeEditing(editing, rule));

  /** Shows and saves the Daily Schedule as it now stands; nothing to do if it is unchanged. */
  const keep = (next: Editing) => {
    if (next === editing) return;
    setEditing(next);
    store
      .saveSchedule(next.schedule)
      .catch((error) => console.error('Could not save the Daily Schedule', error));
  };

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

  /** Takes back the last change and lets go of anyone selected. What is put back is saved. */
  const undoLastChange = () => {
    keep(undo(editing));
    select(null);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelMove();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /** Opens the Daily Schedule for another date, creating it if there is none. */
  const changeDate = (date: ScheduleDate) => {
    select(null);
    openDate(store, roster, date)
      .then((opened) => setEditing(startEditing(opened)))
      .catch((error) => console.error('Could not open the Daily Schedule', error));
  };

  return (
    <>
    <ChangeDate date={schedule.date} onChangeDate={changeDate} />
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
      canUndo={canUndo(editing)}
      onUndo={undoLastChange}
    />
    </>
  );
}
