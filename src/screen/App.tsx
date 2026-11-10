import { useEffect, useRef, useState } from 'react';
import {
  canUndo,
  change as changeEditing,
  clearNote,
  markSent,
  placeCrewMember,
  returnToNotPlaced,
  setNote,
  setTasks,
  startEditing,
  undo,
  type CrewView,
  type DailySchedule,
  type Destination,
  type Editing,
  type ScheduleDate,
} from '../schedule-rules';
import type { CrewDelivery } from '../send';
import { openDate, type Opened, type ScheduleStore } from '../storage';
import { ChangeDate } from './ChangeDate';
import { ScheduleScreen } from './ScheduleScreen';
import { SendBar } from './SendBar';
import { UndoButton } from './UndoButton';
import { useSend } from './useSend';

/**
 * Holds the Daily Schedule being edited (with what Undo can step back through,
 * for this sitting only) and which Crew Member is selected to move or to have
 * a Note typed. Everything that alters the schedule (a change, an Undo, a
 * Send being recorded) goes through `apply`, which works on the schedule as
 * it stands at that instant and saves the result. The screen below only draws
 * and reports clicks. `opened` is what the store held when the page loaded.
 */
export function App({
  store,
  opened,
  delivery,
}: {
  store: ScheduleStore;
  opened: Opened;
  /** How the picture of the Daily Schedule reaches the crew. */
  delivery: CrewDelivery;
}) {
  const roster = opened.roster;
  const [editing, setEditing] = useState<Editing>(() => startEditing(opened.schedule));
  const schedule = editing.schedule;
  /**
   * The same Editing as it stands this instant. State only catches up at the
   * next draw; two changes before then, or a Send that finishes later, must
   * each build on the one before and not on what was last drawn.
   */
  const latest = useRef(editing);
  const [selectedCrewMemberId, setSelectedCrewMemberId] = useState<string | null>(null);
  /** True while a Note is being typed for the selected Crew Member. */
  const [editingNote, setEditingNote] = useState(false);

  /** Puts the Daily Schedule being edited on the screen. */
  const show = (next: Editing) => {
    latest.current = next;
    setEditing(next);
  };

  /**
   * The one place the Daily Schedule being edited is altered. The step is
   * given the schedule as it stands now; what it returns is shown and saved by
   * itself (nothing to do if it is unchanged). Returns the schedule afterwards.
   */
  const apply = (step: (current: Editing) => Editing): DailySchedule => {
    const next = step(latest.current);
    if (next !== latest.current) {
      show(next);
      store
        .saveSchedule(next.schedule)
        .catch((error) => console.error('Could not save the Daily Schedule', error));
    }
    return next.schedule;
  };

  /** Applies one schedule rule. The rules decide whether it is a step for Undo. */
  const change = (rule: (schedule: DailySchedule) => DailySchedule) =>
    apply((current) => changeEditing(current, rule));

  /**
   * A delivered Send is recorded on the Daily Schedule as it stands when the
   * delivery finishes, so a change made meanwhile is kept. The rules make it
   * no step for Undo, and ignore it if another date has been opened since.
   */
  const recordSend = (sent: CrewView, sentAt: string) =>
    change((current) => markSent(current, sent, sentAt));
  const send = useSend({ roster, schedule, delivery, onDelivered: recordSend });

  const select = (crewMemberId: string | null) => {
    setSelectedCrewMemberId(crewMemberId);
    setEditingNote(false);
  };

  /** Lets go of the selected Crew Member: no move, and any Note being typed is dropped. */
  const deselect = () => select(null);

  /** Applies one rule to the selected Crew Member (a move or a Note), then lets go of them. */
  const changeSelected = (
    rule: (schedule: DailySchedule, crewMemberId: string) => DailySchedule,
  ) => {
    if (selectedCrewMemberId === null) return;
    const crewMemberId = selectedCrewMemberId;
    change((current) => rule(current, crewMemberId));
    deselect();
  };

  /** Takes back the last change and lets go of anyone selected. What is put back is saved. */
  const undoLastChange = () => {
    apply(undo);
    deselect();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') deselect();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /** Opens the Daily Schedule for another date, creating it if there is none. */
  const changeDate = (date: ScheduleDate) => {
    deselect();
    openDate(store, roster, date)
      .then((schedule) => show(startEditing(schedule)))
      .catch((error) => console.error('Could not open the Daily Schedule', error));
  };

  return (
    <ScheduleScreen
      roster={roster}
      schedule={schedule}
      selectedCrewMemberId={selectedCrewMemberId}
      editingNote={editingNote}
      onSelectCrewMember={select}
      onDeselect={deselect}
      onPlace={(destination: Destination) =>
        changeSelected((current, crewMemberId) =>
          placeCrewMember(current, crewMemberId, destination),
        )
      }
      onReturnToNotPlaced={() => changeSelected(returnToNotPlaced)}
      onEditNote={() => setEditingNote(true)}
      onSaveNote={(text) =>
        changeSelected((current, crewMemberId) => setNote(current, crewMemberId, text))
      }
      onClearNote={() => changeSelected(clearNote)}
      onSetTasks={(jobId, text) => change((current) => setTasks(current, jobId, text))}
      alertNotPlaced={send.status.kind === 'refused'}
      toolbarButtons={
        <>
          <UndoButton canUndo={canUndo(editing)} onUndo={undoLastChange} />
          <ChangeDate date={schedule.date} onChangeDate={changeDate} />
        </>
      }
      footer={<SendBar send={send} />}
    />
  );
}
