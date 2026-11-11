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
import { openDate, type Opened, type ScheduleStore } from '../storage';
import { ChangeDate } from './ChangeDate';
import { nextOpenJobs, type OpenJobs, type OpenJobsEvent } from './openJobs';
import { SettingsLink } from './SettingsLink';
import { ScheduleScreen } from './ScheduleScreen';
import { SendButton, SendMessage } from './SendBar';
import { useSend } from './useSend';

/**
 * Holds the Daily Schedule being edited and which Crew Member is selected to
 * move or to give a Note or Person Task. Everything that alters the schedule (a
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
  const recordSend = (sent: CrewView, sentAt: string) => {
    const after = change((current) => markSent(current, sent, sentAt));
    // Sent: Jobs left with nobody fold now. A failed Send never gets here.
    if (after.date === sent.date) rebuildOpenJobs(after);
    return after;
  };
  const send = useSend({ roster, schedule, delivery, onDelivered: recordSend });

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
    change((current) => applyEdit(current, scheduleEdit));
    if (scheduleEdit.kind === 'move') deselect();
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
