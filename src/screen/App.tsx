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
import { boardReloads, type Board } from '../storage/reloadOnFocus';
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
import { useOnFocus } from './useOnFocus';
import { useSend } from './useSend';

/**
 * Holds the Daily Schedule being edited and which Crew Member is selected to
 * move or to give a Note or Person Task. Everything that alters the schedule (a
 * change, a Send being recorded) goes through `change`, which works on the
 * schedule as it stands at that instant and saves the result. The screen
 * below only draws and reports clicks. `opened` is what the store held when
 * the page loaded; both are loaded again whenever the page gets the focus
 * back (`boardReloads`). `saves` says whether everything is saved yet
 * (saveQueue.ts).
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
  const [roster, setRosterDrawn] = useState(opened.roster);
  /** The Roster as it stands this instant, like `latest` below for the Daily Schedule. */
  const latestRoster = useRef(roster);
  const setRoster = (next: typeof roster) => {
    latestRoster.current = next;
    setRosterDrawn(next);
  };
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
  /** The open set starts again from this Daily Schedule: a new date, a successful Send, or a reload. */
  const rebuildOpenJobs = (from: DailySchedule, withRoster = latestRoster.current) =>
    openJobsAfter({ kind: 'rebuild', view: scheduleView(withRoster, from) });

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
      openJobsAfter({ kind: 'changed', view: scheduleView(latestRoster.current, next) });
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
   * One edit, applied by the rules to the schedule as it stands now, and
   * remembered for Undo. The rules change nothing if nothing is different.
   */
  const applyNow = (scheduleEdit: ScheduleEdit) => {
    const before = latest.current;
    const after = change((current) => applyEdit(current, scheduleEdit, latestRoster.current));
    if (after !== before) setHistory(remember(history.current, before));
  };

  /**
   * The board as its reloads on focus see it (`boardReloads`), as it stands
   * at the latest draw. A Daily Schedule changed on another device is shown
   * in place of this one, for the same date: anyone selected is let go, the
   * open Jobs start again from it, and Undo starts empty, so it never takes
   * back somebody else's change. Quietly: nothing is said.
   */
  const board: Board = {
    onScreen: () => ({ roster: latestRoster.current, schedule: latest.current }),
    typing: typingInAField,
    show: (found) => {
      setRoster(found.roster);
      if (found.schedule !== latest.current) {
        show(found.schedule);
        deselect();
        setHistory(emptyHistory);
        rebuildOpenJobs(found.schedule, found.roster);
        return;
      }
      // Only the Roster changed: the board stays as it is, less anyone selected who is gone from it.
      setSelectedCrewMemberId((selected) =>
        found.roster.crewMembers.some((crewMember) => crewMember.id === selected) ? selected : null,
      );
    },
    edit: applyNow,
  };
  const boardNow = useRef(board);
  boardNow.current = board;
  const [reloads] = useState(() =>
    boardReloads(store, saves, {
      onScreen: () => boardNow.current.onScreen(),
      typing: () => boardNow.current.typing(),
      show: (found) => boardNow.current.show(found),
      edit: (scheduleEdit) => boardNow.current.edit(scheduleEdit),
    }),
  );

  // Coming back to the board reloads it. A reload put off while a text field
  // had the focus goes ahead once the field is left and everything is saved.
  useOnFocus(reloads.focus);
  useEffect(() => {
    // After the focus has moved on: by then the page knows which field has it, if any.
    const fieldLeft = () => setTimeout(reloads.again);
    document.addEventListener('focusout', fieldLeft);
    const stopListening = saves.subscribe(reloads.again);
    return () => {
      document.removeEventListener('focusout', fieldLeft);
      stopListening();
    };
  }, [reloads, saves]);

  /**
   * Send draws the Daily Schedule as it stands when the picture is made, and
   * waits for a reload on its way first (and the edits held for it), so the
   * crew never gets the picture of an older one. Edits held meanwhile are
   * not saved yet by then: like the button, Send does nothing until they are.
   */
  const send = useSend({
    schedule,
    delivery,
    onDelivered: recordSend,
    latest: board.onScreen,
    ready: async () => {
      await reloads.settled();
      return saves.state() === 'saved';
    },
  });

  /**
   * One edit the Scheduler made. While a reload is on its way it is held, and
   * applied on top of what the reload finds (`boardReloads`). A move (a
   * click-click move or a drop) also lets go of anyone selected; an edit to
   * someone's Note or Person Tasks keeps them selected.
   */
  const edit = (scheduleEdit: ScheduleEdit) => {
    if (!reloads.hold(scheduleEdit)) applyNow(scheduleEdit);
    if (scheduleEdit.kind === 'move') deselect();
  };

  /**
   * Undo: takes back the Scheduler's latest edit (never a Send), and lets go
   * of anyone selected. Not while a reload is on its way: what it would take
   * back may be about to be replaced.
   */
  const undoLast = () => {
    if (reloads.reloading()) return;
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
    openDate(store, latestRoster.current, date)
      .then((next) => {
        show(next);
        rebuildOpenJobs(next);
      })
      .catch((error) => console.error('Could not open the Daily Schedule', error));
  };

  // Undo and Send are drawn twice, and one of each shows: in the header on a
  // wide window, in the bar at the bottom on a phone (screen.css).
  const undoButton = (
    <button
      type="button"
      className="button toolbar-button"
      disabled={!canUndo}
      title="Undo the last change (Ctrl+Z)"
      onClick={undoLast}
    >
      Undo
    </button>
  );
  const sendButton = <SendButton send={send} allSaved={saveState === 'saved'} />;

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
        openJobsAfter({ kind: 'put-away', view: scheduleView(latestRoster.current, latest.current) })
      }
      dateNote={<LastSent send={send} />}
      toolbarButtons={
        <>
          <span className="header-only">{undoButton}</span>
          <ChangeDate date={schedule.date} onChangeDate={changeDate} />
          <PreviewPicture roster={roster} schedule={schedule} />
          <span className="header-only">{sendButton}</span>
        </>
      }
      bottomBar={
        <>
          {undoButton}
          {sendButton}
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

/** Whether a text field has the focus: what is being typed in it is not in the Daily Schedule yet. */
function typingInAField(): boolean {
  return document.activeElement?.closest('input, textarea, [contenteditable]') != null;
}
