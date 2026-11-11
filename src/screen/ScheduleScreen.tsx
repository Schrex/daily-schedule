import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import logoUrl from '../assets/schreiber-logo.png';
import {
  canHaveTasks,
  cardTitle,
  fullDate,
  NOT_PLACED,
  scheduleDateOf,
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
import { DayNotes } from './DayNotes';
import { NoteEditor } from './NoteEditor';
import { emptyOpenJobKeys, foldedHeading, type OpenJobs } from './openJobs';
import { PersonTasks } from './PersonTasks';
import { TasksCell } from './TasksCell';
import { useColumnCount } from './useColumnCount';

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
  /** The Jobs drawn as cards (see openJobs.ts); every other Job is a folded button. */
  openJobs: OpenJobs;
  /** A folded Job's button was tapped with nobody in hand: open it as an empty card. */
  onOpenJob: (jobKey: string) => void;
  /** "Put away empty jobs": every open Job with nobody on it folds now. */
  onPutAwayEmptyJobs: () => void;
  /** "Add note" / "Change note" was clicked for the selected Crew Member. */
  onEditNote: () => void;
  /** The Note typed for the selected Crew Member was saved. */
  onSaveNote: (text: string) => void;
  /** "Remove note" was clicked for the selected Crew Member. */
  onClearNote: () => void;
  /** The Scheduler finished typing the Tasks of a Job, Shop or Trucking: the whole text, one Task per line. */
  onSetTasks: (destination: Destination, text: string) => void;
  /** A Person Task was typed for the selected Crew Member. */
  onAddPersonTask: (text: string) => void;
  /** One of the selected Crew Member's Person Tasks was changed (blank: taken away). */
  onChangePersonTask: (index: number, text: string) => void;
  onRemovePersonTask: (index: number) => void;
  onAddDayNote: (text: string) => void;
  /** A Day Note was changed (blank: taken away). */
  onChangeDayNote: (index: number, text: string) => void;
  onRemoveDayNote: (index: number) => void;
  /** Drawn right beside the date: the Settings gear. */
  dateButtons?: ReactNode;
  /** Drawn at the right end of the header: Change date and Send. */
  toolbarButtons?: ReactNode;
  /** Drawn across the foot of the header: what happened to the last Send. */
  sendMessage?: ReactNode;
}

/** How many are on a Job or Standing Row, in plain words. */
const headcount = (count: number): string => (count === 1 ? '1 person' : `${count} people`);

/** The first name, for the short labels: "Move Brody here". */
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
 * Crew Member who has a Placement also offers "Add note", and at the foot of
 * their card their Person Tasks, to add, change or take away (`PersonTasks`).
 * Under the Job cards are the Notes for the day (`DayNotes`).
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
 * It is a board: a header card (the Schreiber logo, the date, the Settings
 * gear, Change date and Send); a grid of cards, one for each Job; and on the
 * right the Not Placed list and under it the three Standing Rows (Shop,
 * Trucking, Off Work). A card is its name with the Job number and how many at
 * the right, the day's Tasks as plain lines, and its names, one to a line: a
 * grey chip with a dot of the Crew Member's color (a Foreman's is black).
 * While a name is selected it is ringed in blue, and every card it can go to
 * is edged in blue; clicking or tapping one puts them there. The picture sent
 * to the crew (`crewPicture`) is these same cards, one under the other,
 * without what is only the Scheduler's.
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
  openJobs,
  onOpenJob,
  onPutAwayEmptyJobs,
  editingNote,
  onEditNote,
  onSaveNote,
  onClearNote,
  onSetTasks,
  onAddPersonTask,
  onChangePersonTask,
  onRemovePersonTask,
  onAddDayNote,
  onChangeDayNote,
  onRemoveDayNote,
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

  /**
   * The Crew Member in hand: selected to move, or being dragged. Every other
   * place is a place they can go: tinted, and "Move Mike here" on the one
   * under the pointer. `from` is where they are now, which stays plain.
   */
  const placedNow = (crewMemberId: string) => {
    const row = view.rows.find((each) => each.who.some((placed) => placed.crewMember.id === crewMemberId));
    const crewMember =
      row?.who.find((placed) => placed.crewMember.id === crewMemberId)?.crewMember ??
      view.notPlaced.find((each) => each.id === crewMemberId);
    return crewMember ? { crewMember, from: row?.key ?? NOT_PLACED } : undefined;
  };
  const inHand = moving ? placedNow(selected.id) : drag.dragging ? placedNow(drag.dragging.crewMemberId) : undefined;
  const isTarget = (key: string) => inHand !== undefined && inHand.from !== key;
  const moveHere = (key: string) =>
    isTarget(key) && inHand ? (
      <span className="move-here" aria-hidden="true">
        Move {firstName(inHand.crewMember)} here
      </span>
    ) : null;

  /** A Job just opened from its folded button: its card's heading takes the focus once drawn. */
  const [focusJob, setFocusJob] = useState<string | null>(null);
  useEffect(() => {
    if (focusJob === null) return;
    const heading = document.querySelector<HTMLElement>(`[data-row="${focusJob}"] .job`);
    if (!heading) return;
    heading.focus();
    setFocusJob(null);
  });

  /** The board in as many columns as fit (up to three), each packed from the top. */
  const [board, setBoard] = useState<HTMLDivElement | null>(null);
  const columns = useColumnCount(board);

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

  /**
   * A name: a grey chip with a dot of the Crew Member's color (a Foreman's is
   * black), with their Person Tasks, if any, under the name in the same chip.
   */
  const name = (crewMember: CrewMember, personTasks: string[] = []) => (
    <button
      type="button"
      className={`name${crewMember.foreman ? ' name-foreman' : ''}${
        crewMember.id === selected?.id ? ' name-selected' : ''
      }`}
      aria-pressed={crewMember.id === selected?.id}
      onClick={(event) => onNameClick(crewMember, event)}
      {...drag.nameProps(crewMember.id)}
      onDoubleClick={() => onMoveCrewMember(crewMember.id, NOT_PLACED)}
    >
      <span className={`name-dot dot-${crewMember.color}`} aria-hidden="true" />
      <span className="name-lines">
        <span className="name-text">{crewMember.name}</span>
        {personTasks.map((task, index) => (
          <span key={index} className="name-sub">
            {task}
          </span>
        ))}
      </span>
    </button>
  );

  /** One block: a Job card on the board, or a small Standing Row card at the right. */
  const block = ({ destination, ...row }: ScheduleRow) => {
    const here = row.who.some((placed) => placed.crewMember.id === selected?.id);
    const isJob = destination.kind === 'job';
    const { number, name: title } = cardTitle(roster, { destination, ...row });
    return (
      <section
        key={row.key}
        className={`block block-${destination.kind} destination${isTarget(row.key) ? ' block-target' : ''}`}
        aria-label={row.label}
        data-row={row.key}
        onClick={moveSelectedTo(destination)}
        {...drag.dropProps(row.key)}
      >
        <header className="block-head">
          <h2 className="job" tabIndex={isJob ? -1 : undefined}>
            {isJob ? title : row.label}
            {number && <span className="job-number">{number}</span>}
          </h2>
          <span className="count" title={headcount(row.who.length)}>
            {row.who.length}
          </span>
        </header>
        {canHaveTasks(destination) && (
          <TasksCell
            jobLabel={row.label}
            compact={!isJob}
            tasks={row.tasks}
            canEdit={!moving}
            onCommit={(text) => onSetTasks(destination, text)}
          />
        )}
        {row.who.length > 0 && (
          <ul className="names">
            {row.who.map(({ crewMember, note, personTasks }) => (
              <li key={crewMember.id} className={note ? 'noted' : undefined}>
                {name(crewMember, personTasks)}
                {note && <span className="note">{note}</span>}
              </li>
            ))}
          </ul>
        )}
        {here && selectedPlaced && !drag.dragging && (
          // Clicks here are about this Crew Member, not a move to this card.
          // Gone the moment their name starts to be dragged, so it never travels with it.
          <div className="person-panel" onClick={(event) => event.stopPropagation()}>
            {typingNote ? (
              <NoteEditor
                key={selectedPlaced.crewMember.id}
                crewMemberName={selectedPlaced.crewMember.name}
                note={selectedPlaced.note}
                onSave={onSaveNote}
                onClear={onClearNote}
                onCancel={onDeselect}
              />
            ) : (
              <>
                <PersonTasks
                  crewMember={selectedPlaced.crewMember}
                  tasks={selectedPlaced.personTasks ?? []}
                  onAdd={onAddPersonTask}
                  onChange={onChangePersonTask}
                  onRemove={onRemovePersonTask}
                />
                <div className="person-panel-foot">
                  <button type="button" className="button person-note-button" onClick={onEditNote}>
                    {selectedPlaced.note ? 'Change note' : 'Add note'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {moveHere(row.key)}
      </section>
    );
  };

  // Only Jobs fold, and only by the open set: a name held over a folded Job
  // (which `shown` already draws there) does not open it until it is dropped.
  const jobRows = shown.rows.filter((row) => row.destination.kind === 'job' && openJobs.has(row.key));
  const foldedRows = shown.rows.filter(
    (row) => row.destination.kind === 'job' && !openJobs.has(row.key),
  );

  /** Open cards with nobody on them (by who is really there, not a drag's preview). */
  const emptyOpen = emptyOpenJobKeys(openJobs, view);

  /**
   * A folded Job's button: with someone in hand they are put on it (which
   * opens it and lets go of them); with nobody, it opens as an empty card so
   * the work can be typed first. Either way the card's heading gets the focus.
   */
  const tapFolded = (row: ScheduleRow) => {
    if (moving) onMoveCrewMember(selected.id, row.destination);
    else onOpenJob(row.key);
    setFocusJob(row.key);
  };
  const standingRows = shown.rows.filter((row) => row.destination.kind === 'standing-row');

  return (
    <main className={`screen${moving ? ' moving' : ''}`}>
      <header className="toolbar">
        <img className="toolbar-logo" src={logoUrl} alt="Schreiber Excavating" />
        <div className="toolbar-date">
          <h1 className="date-heading">{fullDate(view.date)}</h1>
          {dateButtons}
        </div>

        <div className="toolbar-actions">{toolbarButtons}</div>
        {sendMessage}
      </header>

      <div className="layout">
        <div className="schedule-scroll" data-motion-area>
          <div className="board" ref={setBoard}>
            {Array.from({ length: columns }, (_, column) => (
              <div key={column} className="board-column">
                {jobRows.filter((_, index) => index % columns === column).map(block)}
              </div>
            ))}
          </div>
          {(foldedRows.length > 0 || emptyOpen.length > 0) && (
            <section className="folded-jobs" aria-labelledby="folded-jobs-heading">
              <header className="folded-jobs-head">
                <h2 id="folded-jobs-heading">{foldedHeading(view.date, scheduleDateOf(new Date()))}</h2>
                {emptyOpen.length > 0 && (
                  <button type="button" className="button action" onClick={onPutAwayEmptyJobs}>
                    Put away empty jobs
                  </button>
                )}
              </header>
              {foldedRows.length > 0 && (
                <div className="folded-list">
                  {foldedRows.map((row) => {
                    const { name: title } = cardTitle(roster, row);
                    return (
                      <button
                        key={row.key}
                        type="button"
                        className={`button folded-job${inHand ? ' button-primary' : ''}`}
                        aria-label={inHand ? `Put ${inHand.crewMember.name} on ${title}` : `Open ${title}`}
                        onClick={() => tapFolded(row)}
                        {...drag.dropProps(row.key)}
                      >
                        {inHand ? `Put ${firstName(inHand.crewMember)} on ${title}` : title}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}
          <DayNotes
            key={view.date}
            notes={view.dayNotes}
            onAdd={onAddDayNote}
            onChange={onChangeDayNote}
            onRemove={onRemoveDayNote}
          />
        </div>
        <div className="side" data-motion-area>
          <aside
            className={`not-placed destination${shown.notPlaced.length === 0 ? ' not-placed-none' : ''}${
              isTarget(NOT_PLACED) ? ' block-target' : ''
            }`}
            aria-labelledby="not-placed-heading"
            onClick={moveSelectedTo(NOT_PLACED)}
            {...drag.dropProps(NOT_PLACED)}
          >
            <header className="not-placed-head">
              <h2 id="not-placed-heading">Not placed yet</h2>
              <span className="not-placed-count">{shown.notPlaced.length}</span>
            </header>
            {shown.notPlaced.length > 0 && (
              <ul className="names">
                {shown.notPlaced.map((crewMember) => (
                  <li key={crewMember.id}>{name(crewMember)}</li>
                ))}
              </ul>
            )}
            {moveHere(NOT_PLACED)}
          </aside>

          <div className="yard">{standingRows.map(block)}</div>
        </div>

      </div>

      {drag.overlay}
      <MoveNames motion={motion} scene={view.date} />
    </main>
  );
}
