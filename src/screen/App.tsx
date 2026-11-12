import { useEffect, useRef, useState } from 'react';
import {
  applyEdit,
  markSent,
  scheduleView,
  type CrewView,
  type DailySchedule,
  type ScheduleDate,
  type ScheduleEdit,
} from '../schedule-rules';
import type { CrewDelivery } from '../send';
import { NotSaved, useSaveState } from '../saving/NotSaved';
import { openDate, type Opened, type ScheduleStore } from '../storage';
import type { Saves } from '../storage/saveQueue';
import { ChangeDate } from './ChangeDate';
import { PreviewPicture } from './PreviewPicture';
import { nextOpenJobs, type OpenJobs, type OpenJobsEvent } from './openJobs';
import { HubLink } from './HubLink';
import { SettingsLink } from './SettingsLink';
import { TvLink } from './TvLink';
import { ScheduleScreen } from './ScheduleScreen';
import { SendButton, SendFailure, LastSent } from './SendBar';
import { emptyHistory, remember, undo, type UndoHistory } from './undoHistory';
import { useSend } from './useSend';

/**
 * Holds the Daily Schedule being edited and which Crew Member is selected to
 * move or to give a Note or Person Task. Everything that alters the schedule (a
 * change, a Send being recorded) goes through `change`, which works on the
 * schedule as it stands at that instant and saves the result. The screen
 * below only draws and reports clicks. `opened` is what the store held when
 * the page loaded. `saves` says whether everything is saved yet (saveQueue.ts).
 */
export function App({
  store,
  saves,
  opened,
  delivery,
}: {
  store: ScheduleStore;
  saves: Saves;
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
  /**
   * The Jobs drawn as cards this session (see openJobs.ts); every other Job
   * is folded. Built from who is on the Jobs when the board loads.
   */
  const [openJobs, setOpenJobs] = useState<OpenJobs>(() =>
    nextOpenJobs(new Set(), { kind: 'rebuild', view: scheduleView(roster, opened.schedule) }),
  );
  const openJobsAfter = (event: OpenJobsEvent) => setOpenJobs((open) => nextOpenJobs(open, event));
  /** The open set starts again from this Daily Schedule: a new date, or a successful Send. */
  const rebuildOpenJobs = (from: DailySchedule) =>
    openJobsAfter({ kind: 'rebuild', view: scheduleView(roster, from) });

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
      // Anyone put on a Job, by whatever means, opens it; nothing closes mid-edit.
      openJobsAfter({ kind: 'changed', view: scheduleView(roster, next) });
      // The save queue tries again until it is saved; `saves` reports how it is going.
      void store.saveSchedule(next);
    }
    return next;
  };

  /**
   * A delivered Send is recorded on the Daily Schedule as it stands when the
   * delivery finishes, so a change made meanwhile is kept. The rules ignore
   * it if another date has been opened since.
   */
  const recordSend = (sent: CrewView, sentAt: string) => {
    const after = change((current) => markSent(current, sent, sentAt));
    // Sent: Jobs left with nobody fold now. A failed Send never gets here.
    if (after.date === sent.date) rebuildOpenJobs(after);
    return after;
  };
  const send = useSend({ roster, schedule, delivery, onDelivered: recordSend });
  const saveState = useSaveState(saves);

  /**
   * The schedules before each of the Scheduler's edits, for Undo (see
   * undoHistory.ts). Kept as it stands this instant, like `latest`; the state
   * copy is only for drawing the Undo button.
   */
  const history = useRef<UndoHistory>(emptyHistory);
  const [canUndo, setCanUndo] = useState(false);
  const setHistory = (next: UndoHistory) => {
    history.current = next;
    setCanUndo(next.length > 0);
  };

  const select = (crewMemberId: string | null) => setSelectedCrewMemberId(crewMemberId);

  /** Lets go of the selected Crew Member: no move. */
  const deselect = () => select(null);

  /**
   * One edit the Scheduler made, applied by the rules to the schedule as it
   * stands now. A move (a click-click move or a drop) also lets
   * go of anyone selected; an edit to someone's Note or Person Tasks keeps
   * them selected. The rules change nothing if nothing is different.
   */
  const edit = (scheduleEdit: ScheduleEdit) => {
    const before = latest.current;
    const after = change((current) => applyEdit(current, scheduleEdit, roster));
    if (after !== before) setHistory(remember(history.current, before));
    if (scheduleEdit.kind === 'move') deselect();
  };

  /** Undo: takes back the Scheduler's latest edit (never a Send), and lets go of anyone selected. */
  const undoLast = () => {
    const back = undo(history.current, latest.current);
    if (!back) return;
    setHistory(back.history);
    change(() => back.schedule);
    deselect();
  };
  const undoLatest = useRef(undoLast);
  undoLatest.current = undoLast;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') deselect();
      // Ctrl+Z (Cmd+Z on a Mac) is Undo, except in a field, where it undoes the typing.
      const inField =
        event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable]');
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z' && !inField) {
        event.preventDefault();
        undoLatest.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /** Opens the Daily Schedule for another date, creating it if there is none. */
  const changeDate = (date: ScheduleDate) => {
    deselect();
    // Undo is for the day on the screen: another day starts with nothing to undo.
    setHistory(emptyHistory);
    openDate(store, roster, date)
      .then((next) => {
        show(next);
        rebuildOpenJobs(next);
      })
      .catch((error) => console.error('Could not open the Daily Schedule', error));
  };

  return (
    <ScheduleScreen
      roster={roster}
      schedule={schedule}
      selectedCrewMemberId={selectedCrewMemberId}
      onSelectCrewMember={select}
      onDeselect={deselect}
      onEdit={edit}
      openJobs={openJobs}
      onOpenJob={(jobKey) => openJobsAfter({ kind: 'open', jobKey })}
      onPutAwayEmptyJobs={() =>
        openJobsAfter({ kind: 'put-away', view: scheduleView(roster, latest.current) })
      }
      dateNote={<LastSent send={send} />}
      toolbarButtons={
        <>
          <button
            type="button"
            className="button toolbar-button"
            disabled={!canUndo}
            title="Undo the last change (Ctrl+Z)"
            onClick={undoLast}
          >
            Undo
          </button>
          <ChangeDate date={schedule.date} onChangeDate={changeDate} />
          <PreviewPicture roster={roster} schedule={schedule} />
          <SendButton send={send} allSaved={saveState === 'saved'} />
        </>
      }
      toolbarLinks={
        <>
          <TvLink />
          <SettingsLink />
          <HubLink />
        </>
      }
      sendMessage={
        <>
          <NotSaved state={saveState} />
          <SendFailure send={send} />
        </>
      }
    />
  );
}
