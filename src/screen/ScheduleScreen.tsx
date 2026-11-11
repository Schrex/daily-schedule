import { useState, type MouseEvent, type ReactNode } from 'react';
import {
  fullDate,
  NOT_PLACED,
  scheduleView,
  type CrewMember,
  type DailySchedule,
  type MoveTo,
  type Roster,
  type ScheduleRow,
  type StandingRow,
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
  /** The Scheduler finished typing a Job's Tasks: the whole text, one Task per line. */
  onSetTasks: (jobId: string, text: string) => void;
  /** Send was just refused: make the Not Placed list and its names stand out. */
  alertNotPlaced?: boolean;
  /** Drawn right beside the date: the Settings gear. */
  dateButtons?: ReactNode;
  /** Drawn at the right end of the header: Undo, Change date and Send. */
  toolbarButtons?: ReactNode;
  /** Drawn across the foot of the header: what happened to the last Send. */
  sendMessage?: ReactNode;
}

/** How many are on a Job or Standing Row, in plain words. */
const headcount = (count: number): string => (count === 1 ? '1 person' : `${count} people`);

/** What a Standing Row is, in the small line over its name. */
const STANDING_KIND: Record<StandingRow, string> = {
  shop: 'Yard',
  trucking: 'Yard',
  'off-work': 'Away',
};

/**
 * A block's title in two parts: the small line over it (the Job number, or
 * what kind of place it is) and the name itself, large. A Job that has left
 * the roster keeps the label it was sent with.
 */
function blockTitle(roster: Roster, row: ScheduleRow): { over: string; title: string } {
  const { destination } = row;
  if (destination.kind === 'standing-row') {
    return { over: STANDING_KIND[destination.standingRow], title: row.label };
  }
  const job = roster.jobs.find((candidate) => candidate.id === destination.jobId);
  return job ? { over: job.jobNumber ?? 'Job', title: job.name } : { over: 'Job', title: row.label };
}

/** The first name, for the short buttons: "Put Brody here". */
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
 * It is a board: a header card (the date, the hint, Undo, Change date and
 * Send), the Not Placed list on the left, and a grid of cards, one for each
 * Job and Standing Row. A card is the Job (its number small over its name),
 * how many are on it, the day's Tasks in a tinted box, and its names, one to
 * a line. While a name is being moved each card offers "Put ... here". The
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

  return (
    <main className={`screen${moving ? ' moving' : ''}`}>
      <header className="toolbar">
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
                <span className="on-wide">
                  Drag a name to a job, or click a name and then click the job. Click a job's tasks to
                  change them.
                </span>
                <span className="on-narrow">Tap a name, then tap the job.</span>
              </>
            )}
          </div>
        </div>

        <div className="toolbar-actions">{toolbarButtons}</div>
        {sendMessage}
      </header>

      <div className="layout">
        <aside
          className={`not-placed destination${alertNotPlaced ? ' not-placed-alert' : ''}`}
          aria-labelledby="not-placed-heading"
          onClick={moveSelectedTo(NOT_PLACED)}
          data-motion-area
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

        <div className="schedule-scroll" data-motion-area>
          <div className="board">
            {shown.rows.map(({ destination, ...row }) => {
              const { over, title } = blockTitle(roster, { destination, ...row });
              const here = row.who.some((placed) => placed.crewMember.id === selected?.id);
              return (
                <section
                  key={row.key}
                  className={`block block-${destination.kind} destination`}
                  aria-label={row.label}
                  data-row={row.key}
                  onClick={moveSelectedTo(destination)}
                  {...drag.dropProps(row.key)}
                >
                  <header className="block-head">
                    <div className="block-title">
                      <span className="job-number">{over}</span>
                      <h2 className="job">{title}</h2>
                    </div>
                    <span className="count">{headcount(row.who.length)}</span>
                  </header>
                  {destination.kind === 'job' && (
                    <TasksCell
                      jobLabel={row.label}
                      heading={tasksHeading}
                      tasks={row.tasks}
                      canEdit={!moving}
                      onCommit={(text) => onSetTasks(destination.jobId, text)}
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
                  {/* Room to drop a name on, and while one is moving, the button that puts them here. */}
                  <div className="block-foot">
                    {moving && !here && (
                      // The click carries on to the card around it: the destination.
                      <button type="button" className="button button-primary place-here">
                        Put {firstName(selected)} here
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>

      {drag.overlay}
      <MoveNames motion={motion} scene={view.date} />
    </main>
  );
}
