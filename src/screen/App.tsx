import { useEffect, useRef, useState } from 'react';
import {
  clearNote,
  markSent,
  moveCrewMember,
  setNote,
  setTasks,
  type CrewView,
  type DailySchedule,
  type MoveTo,
  type ScheduleDate,
} from '../schedule-rules';
import type { CrewDelivery } from '../send';
import { openDate, type Opened, type ScheduleStore } from '../storage';
import { ChangeDate } from './ChangeDate';
import { SettingsLink } from './SettingsLink';
import { ScheduleScreen } from './ScheduleScreen';
import { SendButton, SendMessage } from './SendBar';
import { useSend } from './useSend';

/**
 * Holds the Daily Schedule being edited and which Crew Member is selected to
 * move or to have a Note typed. Everything that alters the schedule (a
 * change, a Send being recorded) goes through `change`, which works on the
 * schedule as it stands at that instant and saves the result. The screen
 * below only draws and reports clicks. `opened` is what the store held when
 * the page loaded.
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
  const [schedule, setSchedule] = useState<DailySchedule>(opened.schedule);
  /**
   * The same Daily Schedule as it stands this instant. State only catches up
   * at the next draw; two changes before then, or a Send that finishes later,
   * must each build on the one before and not on what was last drawn.
   */
  const latest = useRef(schedule);
  const [selectedCrewMemberId, setSelectedCrewMemberId] = useState<string | null>(null);
  /** True while a Note is being typed for the selected Crew Member. */
  const [editingNote, setEditingNote] = useState(false);

  /** Puts a Daily Schedule on the screen. */
  const show = (next: DailySchedule) => {
    latest.current = next;
    setSchedule(next);
  };

  /**
   * The one place the Daily Schedule being edited is altered. The rule is
   * given the schedule as it stands now; what it returns is shown and saved by
   * itself (nothing to do if it is unchanged). Returns the schedule afterwards.
   */
  const change = (rule: (schedule: DailySchedule) => DailySchedule): DailySchedule => {
    const next = rule(latest.current);
    if (next !== latest.current) {
      show(next);
      store
        .saveSchedule(next)
        .catch((error) => console.error('Could not save the Daily Schedule', error));
    }
    return next;
  };

  /**
   * A delivered Send is recorded on the Daily Schedule as it stands when the
   * delivery finishes, so a change made meanwhile is kept. The rules ignore
   * it if another date has been opened since.
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

  /** Applies one rule to the selected Crew Member (a Note), then lets go of them. */
  const changeSelected = (
    rule: (schedule: DailySchedule, crewMemberId: string) => DailySchedule,
  ) => {
    if (selectedCrewMemberId === null) return;
    const crewMemberId = selectedCrewMemberId;
    change((current) => rule(current, crewMemberId));
    deselect();
  };

  /**
   * Moves one Crew Member, selected or not, however the Scheduler did it (a
   * click-click move, a drop, a double-click), and lets go of anyone selected.
   * The rules change nothing if they are already there.
   */
  const move = (crewMemberId: string, to: MoveTo) => {
    change((current) => moveCrewMember(current, crewMemberId, to));
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
      .then(show)
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
      onMoveCrewMember={move}
      onEditNote={() => setEditingNote(true)}
      onSaveNote={(text) =>
        changeSelected((current, crewMemberId) => setNote(current, crewMemberId, text))
      }
      onClearNote={() => changeSelected(clearNote)}
      onSetTasks={(jobId, text) => change((current) => setTasks(current, jobId, text))}
      alertNotPlaced={send.status.kind === 'refused'}
      dateButtons={<SettingsLink />}
      toolbarButtons={
        <>
          <ChangeDate date={schedule.date} onChangeDate={changeDate} />
          <SendButton send={send} />
        </>
      }
      sendMessage={<SendMessage send={send} />}
    />
  );
}
