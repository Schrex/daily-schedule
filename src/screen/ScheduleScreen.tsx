import { useState, type MouseEvent, type ReactNode } from 'react';
import logoUrl from '../assets/schreiber-logo.png';
import {
  canHaveTasks,
  fullDate,
  NOT_PLACED,
  scheduleView,
  type CrewMember,
  type DailySchedule,
  type MoveTo,
  type Roster,
  type Destination,
  type ScheduleRow,
} from '../schedule-rules';
import { useNameDrag } from './drag/useNameDrag';
import { dropTarget, viewWhileDragging } from './dropPreview';
import { MoveNames } from './motion/MoveNames';
import { createNameMotion } from './motion/nameMotion';
import { NoteEditor } from './NoteEditor';
import { TasksCell } from './TasksCell';

interface ScheduleScreenProps {
  roster: Roster;
  schedule: DailySchedule;
  /** The Crew Member picked up to move, or to have a Note typed, if any. */
  selectedCrewMemberId: string | null;
  /** True while a Note is being typed for the selected Crew Member (no move then). */
  editingNote: boolean;
  onSelectCrewMember: (crewMemberId: string) => void;
  /** The selected name was clicked again, or "Cancel" on a Note: let go of them. */
  onDeselect: () => void;
  /**
   * The Scheduler moved a Crew Member to a Job, a Standing Row or Not Placed:
   * by clicking there with them selected, by dropping their name there, or (to
   * Not Placed) by double-clicking their name.
   */
  onMoveCrewMember: (crewMemberId: string, to: MoveTo) => void;
  /** "Add note" / "Change note" was clicked for the selected Crew Member. */
  onEditNote: () => void;
  /** The Note typed for the selected Crew Member was saved. */
  onSaveNote: (text: string) => void;
  /** "Remove note" was clicked for the selected Crew Member. */
  onClearNote: () => void;
  /** The Scheduler finished typing the Tasks of a Job, Shop or Trucking: the whole text, one Task per line. */
  onSetTasks: (destination: Destination, text: string) => void;
  /** Send was just refused: make the Not Placed list and its names stand out. */
  alertNotPlaced?: boolean;
  /** Drawn right beside the date: the Settings gear. */
  dateButtons?: ReactNode;
  /** Drawn at the right end of the header: Change date and Send. */
  toolbarButtons?: ReactNode;
  /** Drawn across the foot of the header: what happened to the last Send. */
  sendMessage?: ReactNode;
}

/** How many are on a Job or Standing Row, in plain words. */
const headcount = (count: number): string => (count === 1 ? '1 person' : `${count} people`);

/**
 * A Job card's title in two parts: the Job number, small, over the name,
 * large ("JOB" for a Job without one). A Job that has left the roster keeps
 * the label it was sent with.
 */
function jobTitle(roster: Roster, row: ScheduleRow): { number: string; title: string } {
  const { destination } = row;
  const job =
    destination.kind === 'job'
      ? roster.jobs.find((candidate) => candidate.id === destination.jobId)
      : undefined;
  return job ? { number: job.jobNumber ?? 'JOB', title: job.name } : { number: 'JOB', title: row.label };
}

/** The first name, for the short button: "Take Brody off the board". */
const firstName = (crewMember: CrewMember): string => crewMember.name.split(' ')[0] ?? crewMember.name;

/**
 * The Scheduler's screen. Thin: it asks the schedule rules for the view, draws
 * it, and reports clicks. It applies no rule (ordering, Not Placed, ...) itself.
 *
 * Moving is click-click: click a name to select it, then click a Job, a
 * Standing Row or the Not Placed list. While a name is selected, a click
 * anywhere in one of those blocks (even on another name) is the destination.
 *
 * Double-clicking a name moves that Crew Member to Not Placed. The browser
 * reports a double-click as two clicks and then the double-click, so the name
 * is selected and let go of first. A double-click made with a shaky hand, which
 * the browser takes for a small drag, is reported by `useNameDrag` instead.
 *
 * With no name selected, clicking a Job's Tasks lets him type them. A selected
 * Crew Member who has a Placement also offers "Add note".
 *
 * A name can also be dragged and dropped on one of those blocks (`useNameDrag`).
 * The drag only says who was dropped where; like a click, it is reported.
 * While a name is held over a destination, the schedule is drawn as the rules
 * say it would be after the drop (`viewWhileDragging`), so the names there
 * make room where it would land.
 *
 * Every move is shown: a name that is somewhere else after a redraw travels
 * there from where it was (`MoveNames`), whatever moved it.
 *
 * It is a board: a header card (the Schreiber logo, the date, the hint,
 * Change date and Send); on the left the Not Placed list and under it the
 * three Standing Rows (Shop, Trucking, Off Work) as small cards; and a grid
 * of cards, one for each Job. A Job card is its number and how many are on
 * it, the Job's name, the day's Tasks in a pale yellow box, and its names,
 * one to a line. Shop and Trucking can have Tasks too, as a smaller note. While a name is being moved, every card they can go to is
 * highlighted in the accent; clicking or tapping one puts them there. The
 * picture sent to the crew (`crewPicture`) is these same cards, one under
 * the other, without what is only the Scheduler's.
 *
 * It is one screen: the header stays put, and so does the Not Placed list
 * (beside the board on a wide window, above it on a narrow one). Only the
 * board scrolls.
 */
export function ScheduleScreen({
  roster,
  schedule,
  selectedCrewMemberId,
  onSelectCrewMember,
  onDeselect,
  onMoveCrewMember,
  editingNote,
  onEditNote,
  onSaveNote,
  onClearNote,
  onSetTasks,
  alertNotPlaced = false,
  dateButtons,
  toolbarButtons,
  sendMessage,
}: ScheduleScreenProps) {
  const view = scheduleView(roster, schedule);
  /** Where the selected Crew Member is now; undefined when Not Placed (no Placement, so no Note). */
  const selectedPlaced = view.rows
    .flatMap((row) => row.who)
    .find((placed) => placed.crewMember.id === selectedCrewMemberId);
  // Anyone the view shows can be selected, so look there and not in the roster.
  const selected =
    selectedPlaced?.crewMember ??
    view.notPlaced.find((crewMember) => crewMember.id === selectedCrewMemberId);
  const typingNote = selected !== undefined && selectedPlaced !== undefined && editingNote;
  const moving = selected !== undefined && !typingNote;

  // Dragging a name: no drag while a Note is being typed. A drop names the block by its key.
  const [motion] = useState(createNameMotion);
  const drag = useNameDrag({
    enabled: !typingNote,
    onDrop: (crewMemberId, over) => {
      const to = dropTarget(view, over);
      if (to !== null) onMoveCrewMember(crewMemberId, to);
    },
    onLetGo: motion.letGoAt,
    onShakyDoubleClick: (crewMemberId) => onMoveCrewMember(crewMemberId, NOT_PLACED),
  });
  /** What is drawn: while a name is held over a destination, the schedule as the drop would leave it. */
  const shown = viewWhileDragging(roster, schedule, drag.dragging);

  const onNameClick = (crewMember: CrewMember, event: MouseEvent) => {
    if (!moving) {
      event.stopPropagation();
      onSelectCrewMember(crewMember.id);
    } else if (crewMember.id === selected?.id) {
      event.stopPropagation();
      onDeselect();
    }
    // Otherwise the click carries on to the block the name sits in: the destination.
  };

  /** A destination was clicked while a Crew Member is selected: they go there. */
  const moveSelectedTo = (to: MoveTo) => (moving ? () => onMoveCrewMember(selected.id, to) : undefined);

  const name = (crewMember: CrewMember) => (
    <button
      type="button"
      className={`name color-${crewMember.color}${
        crewMember.id === selected?.id ? ' name-selected' : ''
      }`}
      aria-pressed={crewMember.id === selected?.id}
      onClick={(event) => onNameClick(crewMember, event)}
      {...drag.nameProps(crewMember.id)}
      onDoubleClick={() => onMoveCrewMember(crewMember.id, NOT_PLACED)}
    >
      {crewMember.name}
    </button>
  );

  /** "Wednesday's work": the Tasks are for the day being scheduled. */
  const tasksHeading = `${fullDate(view.date).split(',')[0]}'s work`;

  /** One block: a Job card in the grid, or a small Standing Row card on the left. */
  const block = ({ destination, ...row }: ScheduleRow) => {
    const here = row.who.some((placed) => placed.crewMember.id === selected?.id);
    const isJob = destination.kind === 'job';
    const { number, title } = jobTitle(roster, { destination, ...row });
    return (
      <section
        key={row.key}
        className={`block block-${destination.kind} destination${
          moving && !here ? ' block-target' : ''
        }`}
        aria-label={row.label}
        data-row={row.key}
        onClick={moveSelectedTo(destination)}
        {...drag.dropProps(row.key)}
      >
        {isJob ? (
          <header className="block-head">
            <span className="job-number">
              {number} · {headcount(row.who.length)}
            </span>
            <h2 className="job">{title}</h2>
          </header>
        ) : (
          <header className="block-head block-head-yard">
            <h2 className="job">{row.label}</h2>
            <span className="count">{headcount(row.who.length)}</span>
          </header>
        )}
        {canHaveTasks(destination) && (
          <TasksCell
            jobLabel={row.label}
            heading={tasksHeading}
            compact={!isJob}
            tasks={row.tasks}
            canEdit={!moving}
            onCommit={(text) => onSetTasks(destination, text)}
          />
        )}
        {row.who.length === 0 ? (
          <p className="block-empty">Nobody here yet</p>
        ) : (
          <ul className="names">
            {row.who.map(({ crewMember, note }) => (
              <li key={crewMember.id} className={note ? 'noted' : undefined}>
                {name(crewMember)}
                {note && <span className="note">{note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  };

  const jobRows = shown.rows.filter((row) => row.destination.kind === 'job');
  const standingRows = shown.rows.filter((row) => row.destination.kind === 'standing-row');

  return (
    <main className={`screen${moving ? ' moving' : ''}`}>
      <header className="toolbar">
        <img className="toolbar-logo" src={logoUrl} alt="Schreiber Excavating" />
        <div className="toolbar-title">
          <div className="toolbar-date">
            <h1 className="date-heading">{fullDate(view.date)}</h1>
            {dateButtons}
          </div>

          <div
            className={`move-hint${moving ? ' move-hint-active' : ''}${typingNote ? ' move-hint-note' : ''}`}
            role="status"
          >
            {typingNote ? (
              <NoteEditor
                key={selected.id}
                crewMemberName={selected.name}
                note={selectedPlaced.note}
                onSave={onSaveNote}
                onClear={onClearNote}
                onCancel={onDeselect}
              />
            ) : moving ? (
              <>
                <span>
                  <span className="on-wide">Now click the job for </span>
                  <span className="on-narrow">Now tap the job for </span>
                  <strong>{selected.name}</strong>.
                  <span className="move-hint-cancel on-wide"> (Click the name again to cancel.)</span>
                </span>
                {selectedPlaced && (
                  <button type="button" className="button action" onClick={onEditNote}>
                    {selectedPlaced.note ? 'Change note' : 'Add note'}
                  </button>
                )}
              </>
            ) : (
              <>
                <span className="on-wide">Drag a name to a job, or click a name and then click the job.</span>
                <span className="on-narrow">Tap a name, then tap the job.</span>
              </>
            )}
          </div>
        </div>

        <div className="toolbar-actions">{toolbarButtons}</div>
        {sendMessage}
      </header>

      <div className="layout">
        <div className="side" data-motion-area>
          <aside
            className={`not-placed destination${alertNotPlaced ? ' not-placed-alert' : ''}`}
            aria-labelledby="not-placed-heading"
            onClick={moveSelectedTo(NOT_PLACED)}
            {...drag.dropProps(NOT_PLACED)}
          >
            <header className="not-placed-head">
              <h2 id="not-placed-heading">Not placed yet</h2>
              <span className="not-placed-count">{shown.notPlaced.length}</span>
            </header>
            {shown.notPlaced.length === 0 ? (
              <p className="not-placed-empty">Everyone has a place.</p>
            ) : (
              <ul className="names">
                {shown.notPlaced.map((crewMember) => (
                  <li key={crewMember.id}>{name(crewMember)}</li>
                ))}
              </ul>
            )}
            {moving && selectedPlaced && (
              // The click carries on to the list around it: the destination.
              <button type="button" className="button off-board">
                Take {firstName(selected)} off the board
              </button>
            )}
          </aside>

          <div className="yard">{standingRows.map(block)}</div>
        </div>

        <div className="schedule-scroll" data-motion-area>
          <div className="board">{jobRows.map(block)}</div>
        </div>
      </div>

      {drag.overlay}
      <MoveNames motion={motion} scene={view.date} />
    </main>
  );
}
