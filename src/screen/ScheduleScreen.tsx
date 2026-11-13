import { Fragment, useEffect, useRef, useState, type MouseEvent, type ReactNode, type UIEvent } from 'react';
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
  type ScheduleEdit,
  type ScheduleRow,
} from '../schedule-rules';
import { useNameDrag } from './drag/useNameDrag';
import { dropTarget, viewWhileDragging } from './dropPreview';
import { MoveNames } from './motion/MoveNames';
import { createNameMotion } from './motion/nameMotion';
import { DayNotes } from './DayNotes';
import { collapsedDate, headerCollapsed } from './headerCollapse';
import { foldedHeading, showNoCrewSection, showPutAway, type OpenJobs } from './openJobs';
import { NameLines, nameClass } from './NameChip';
import { PersonAdd, PersonLines } from './PersonTasks';
import { inHand as inHandOf, isTarget as isTargetFor, nameClick, selectedCrewMember, selectionOf } from './selection';
import { TasksCell } from './TasksCell';

interface ScheduleScreenProps {
  roster: Roster;
  schedule: DailySchedule;
  /** The Crew Member selected, if any: what that means is `selection.ts`'s to say. */
  selectedCrewMemberId: string | null;
  onSelectCrewMember: (crewMemberId: string) => void;
  /** Let go of whoever is selected. */
  onDeselect: () => void;
  /**
   * The Scheduler changed the Daily Schedule: moved someone (a click, a drop,
   * a drop on Not placed yet), typed Tasks, a Note, a Person Task or a
   * Day Note. The rules apply it (`applyEdit`).
   */
  onEdit: (edit: ScheduleEdit) => void;
  /** The Jobs drawn as cards (see openJobs.ts); every other Job is a folded button. */
  openJobs: OpenJobs;
  /** A folded Job's button was tapped with nobody in hand: open it as an empty card. */
  onOpenJob: (jobKey: string) => void;
  /** "Put away empty jobs": every open Job with nobody on it folds now. */
  onPutAwayEmptyJobs: () => void;
  /** Drawn under the date: when it was last Sent. */
  dateNote?: ReactNode;
  /** Drawn at the right of the header: Undo, Change date, Preview and Send. */
  toolbarButtons?: ReactNode;
  /** Drawn at the far right of the header, set apart: TV view and Settings. */
  toolbarLinks?: ReactNode;
  /** Drawn across the foot of the header: a Send that failed. */
  sendMessage?: ReactNode;
  /** Drawn in the bar at the bottom of a phone's screen: Undo and Send. */
  bottomBar?: ReactNode;
}

/** How many are on a Job or Standing Row, in plain words. */
const headcount = (count: number): string => (count === 1 ? '1 person' : `${count} people`);

/** The first name, for the short labels: "Move Brody here". */
const firstName = (crewMember: CrewMember): string => crewMember.name.split(' ')[0] ?? crewMember.name;

/**
 * The Scheduler's screen. Thin: it asks the schedule rules for the view, draws
 * it, and reports clicks. It applies no rule (ordering, Not Placed, ...) itself.
 *
 * Someone Not Placed moves click-click: click their name to select it, then
 * click a Job or a Standing Row. Selecting someone already placed opens their
 * panel (Add task, Add note) instead: nothing is tinted as a place to go, and
 * a click on a card lets go of them. Anyone can be dragged.
 *
 * With no name selected, clicking a Job's Tasks lets him type them. A selected
 * Crew Member who has a Placement gets their Person Tasks and Note with × in
 * their chip, and a field under it to add more (`PersonTasks`); a click
 * anywhere else lets go of them. Under the Job cards are the Notes for the
 * day (`DayNotes`).
 *
 * A name can also be dragged and dropped on one of those blocks (`useNameDrag`),
 * at a spot among the names there, its own card included: that is how a card's
 * names are put in the order wanted (a Job's Foremen always stay first). The
 * drag only says who was dropped where; like a click, it is reported.
 * While a name is held over a destination, the schedule is drawn as the rules
 * say it would be after the drop (`viewWhileDragging`), so the names there
 * make room where it would land. A tap move still puts them last.
 *
 * Every move is shown: a name that is somewhere else after a redraw travels
 * there from where it was (`MoveNames`), whatever moved it.
 *
 * It is a board: a header card (the Schreiber logo, the date, the Settings
 * gear, Change date and Send); a grid of cards, one for each Job; and on the
 * right the Not Placed list and under it the three Standing Rows (Shop,
 * Trucking, Off Work). A card is its name with the Job number and how many at
 * the right, the day's Tasks as plain lines, and its names, one to a line: a
 * grey chip with a dot of the Crew Member's color (a Foreman's top line is
 * black). The name selected is ringed in blue; while someone is in hand,
 * every card they can go to is tinted. The picture sent
 * to the crew (`crewPicture`) is these same cards, one under the other,
 * without what is only the Scheduler's.
 *
 * It is one screen: the header stays put, and so does the Not Placed list
 * (beside the board on a wide window, above it on a narrow one). Only the
 * board scrolls.
 *
 * On a phone the Jobs get the screen: once the page of cards has scrolled the
 * header is one line (a short date, Change date and Preview, and under it
 * "Not saved" or a failed Send if there is one), open again at the top; and
 * Undo and Send are in a bar at the bottom.
 */
export function ScheduleScreen({
  roster,
  schedule,
  selectedCrewMemberId,
  onSelectCrewMember,
  onDeselect,
  onEdit,
  openJobs,
  onOpenJob,
  onPutAwayEmptyJobs,
  dateNote,
  toolbarButtons,
  toolbarLinks,
  sendMessage,
  bottomBar,
}: ScheduleScreenProps) {
  // On a phone the header is one line once the page of cards has scrolled
  // (`headerCollapsed`). Only a narrow screen's CSS acts on it.
  const [collapsed, setCollapsed] = useState(false);
  const onPageScroll = (event: UIEvent<HTMLDivElement>) => {
    const page = event.currentTarget;
    // Only the page's own scrolling counts, not a list scrolling inside it.
    if (event.target !== page) return;
    const scroll = { scrolled: page.scrollTop, room: page.scrollHeight - page.clientHeight };
    setCollapsed((was) => headerCollapsed(was, scroll));
  };

  const view = scheduleView(roster, schedule);
  const selection = selectionOf(view, selectedCrewMemberId);
  const selected = selectedCrewMember(selection);
  const moving = selection.mode === 'moving';
  const panelOpen = selection.mode === 'panel';
  const move = (crewMemberId: string, to: MoveTo) => onEdit({ kind: 'move', crewMemberId, to });

  // Dragging a name. A drop names the block by its key; the copy lifted is the name as drawn here.
  const [motion] = useState(createNameMotion);
  const drag = useNameDrag({
    drawLifted: (crewMemberId) => {
      const placed = view.rows.flatMap((row) => row.who).find((each) => each.crewMember.id === crewMemberId);
      const crewMember = placed?.crewMember ?? view.notPlaced.find((each) => each.id === crewMemberId);
      return (
        crewMember && (
          <div className={nameClass(crewMember)}>
            <NameLines crewMember={crewMember} personTasks={placed?.personTasks} />
          </div>
        )
      );
    },
    // Let go at a spot: it lands there (the rules keep a Job's Foremen first).
    onDrop: (crewMemberId, over, before) => {
      const to = dropTarget(view, over);
      if (to !== null) onEdit({ kind: 'move', crewMemberId, to, before });
    },
    onLetGo: motion.letGoAt,
  });
  /** What is drawn: while a name is held over a destination, the schedule as the drop would leave it. */
  const shown = viewWhileDragging(roster, schedule, drag.dragging);

  /** Who is in hand (picked up, or dragged): every other place is tinted, with "Move Mike here" on the one pointed at. */
  const inHand = inHandOf(view, selection, drag.dragging?.crewMemberId ?? null);
  const isTarget = (key: string) => isTargetFor(inHand, key);
  const moveHere = (key: string) =>
    isTarget(key) && inHand ? (
      <span className="move-here" aria-hidden="true">
        Move {firstName(inHand.crewMember)} here
      </span>
    ) : null;

  /**
   * When someone is let go of while the focus was in their panel (Escape in
   * its field, the last × in it), the panel goes and the focus with it. Hand
   * it back to their name so the keyboard keeps its place.
   */
  const wasSelected = useRef<string | null>(null);
  useEffect(() => {
    const was = wasSelected.current;
    wasSelected.current = selectedCrewMemberId;
    if (was === null || was === selectedCrewMemberId) return;
    if (document.activeElement !== null && document.activeElement !== document.body) return;
    document.querySelector<HTMLElement>(`[data-crew-member="${CSS.escape(was)}"]`)?.focus();
  }, [selectedCrewMemberId]);

  /** A Job just opened from its folded button: its card's heading takes the focus once drawn. */
  const [focusJob, setFocusJob] = useState<string | null>(null);
  useEffect(() => {
    if (focusJob === null) return;
    const heading = document.querySelector<HTMLElement>(`[data-row="${focusJob}"] .job`);
    if (!heading) return;
    heading.focus();
    setFocusJob(null);
  });


  const onNameClick = (crewMember: CrewMember, event: MouseEvent) => {
    const does = nameClick(selection, crewMember.id);
    // A pass-through carries on to the block the name sits in: the destination.
    if (does === 'pass-through') return;
    event.stopPropagation();
    if (does === 'select') onSelectCrewMember(crewMember.id);
    else onDeselect();
  };

  /** A destination was clicked with a Crew Member picked up to move: they go there. */
  const moveSelectedTo = (to: MoveTo) =>
    selection.mode === 'moving' ? () => move(selection.crewMember.id, to) : undefined;

  /**
   * While someone's panel is open, a click anywhere outside their chip and
   * the field under it closes it: a card, the header, the empty page. A click
   * on another name is left to select that name instead.
   */
  useEffect(() => {
    if (!panelOpen) return;
    const onClick = (event: globalThis.MouseEvent) => {
      // The path as it was when clicked: a × or a task tapped to change it may be gone by now.
      const inside = event
        .composedPath()
        .some((at) => at instanceof Element && at.matches('.person-open, .person-panel, .name'));
      if (inside) return;
      onDeselect();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [panelOpen, onDeselect]);

  /** A name: the chip (`NameChip`), to click or drag. */
  const name = (crewMember: CrewMember, personTasks: string[] = []) => (
    <button
      type="button"
      className={nameClass(crewMember, crewMember.id === selected?.id)}
      aria-pressed={crewMember.id === selected?.id}
      onClick={(event) => onNameClick(crewMember, event)}
      {...drag.nameProps(crewMember.id)}
    >
      <NameLines crewMember={crewMember} personTasks={personTasks} />
    </button>
  );

  /** The selected Crew Member with a Placement, whose panel is open; none while their name is dragged. */
  const open = selection.mode === 'panel' && !drag.dragging ? selection.placed : undefined;
  /** An edit to the open Crew Member's own Note or Person Tasks. */
  const editOpen = (edit: (crewMemberId: string) => ScheduleEdit) => {
    if (open) onEdit(edit(open.crewMember.id));
  };

  const setNote = (text: string) => editOpen((crewMemberId) => ({ kind: 'set-note', crewMemberId, text }));
  const addTask = (text: string) => editOpen((crewMemberId) => ({ kind: 'add-person-task', crewMemberId, text }));
  const changeTask = (index: number, text: string) =>
    editOpen((crewMemberId) => ({ kind: 'change-person-task', crewMemberId, index, text }));
  const removeTask = (index: number) =>
    editOpen((crewMemberId) => ({ kind: 'remove-person-task', crewMemberId, index }));

  /**
   * Under the open Crew Member's chip (edged in the blue of their ring): one
   * field with Add task and Add note. Gone the moment their name starts to be
   * dragged, so it never travels with it.
   */
  const personPanel = open && (
    <li className="person-panel" onClick={(event) => event.stopPropagation()}>
      <PersonAdd crewMember={open.crewMember} onAddTask={addTask} onSetNote={setNote} />
    </li>
  );

  /** One block: a Job card on the board, or a small Standing Row card at the right. */
  const block = ({ destination, ...row }: ScheduleRow) => {
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
            onCommit={(text) => onEdit({ kind: 'set-tasks', destination, text })}
          />
        )}
        {row.who.length > 0 && (
          <ul className="names">
            {row.who.map(({ crewMember, note, personTasks = [] }) => {
              // The open Crew Member's tasks and Note each get × in place.
              const isOpen = crewMember.id === open?.crewMember.id;
              return (
                <Fragment key={crewMember.id}>
                  <li className={`${note ? 'noted' : ''}${isOpen ? ' person-open' : ''}`.trim() || undefined}>
                    {name(crewMember, isOpen ? [] : personTasks)}
                    {isOpen ? (
                      <PersonLines
                        crewMember={crewMember}
                        note={note}
                        tasks={personTasks}
                        onChange={changeTask}
                        onRemove={removeTask}
                        onSetNote={setNote}
                      />
                    ) : (
                      note && <span className="note">{note}</span>
                    )}
                  </li>
                  {isOpen && personPanel}
                </Fragment>
              );
            })}
          </ul>
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

  /**
   * A folded Job's button: with someone in hand they are put on it (which
   * opens it and lets go of them); with nobody, it opens as an empty card so
   * the work can be typed first. Either way the card's heading gets the focus.
   */
  const tapFolded = (row: ScheduleRow) => {
    if (selection.mode === 'moving') move(selection.crewMember.id, row.destination);
    else onOpenJob(row.key);
    setFocusJob(row.key);
  };
  const standingRows = shown.rows.filter((row) => row.destination.kind === 'standing-row');

  return (
    <main className={`screen${moving ? ' moving' : ''}`}>
      <header className={`toolbar${collapsed ? ' toolbar-collapsed' : ''}`}>
        <img className="toolbar-logo" src={logoUrl} alt="Schreiber Excavating" />
        <div className="toolbar-date">
          <h1 className="date-heading">
            <span className="date-full">{fullDate(view.date)}</span>
            <span className="date-short" aria-hidden="true">
              {collapsedDate(view.date)}
            </span>
          </h1>
          {dateNote}
        </div>

        <div className="toolbar-actions">
          {toolbarButtons}
          {toolbarLinks && <div className="toolbar-links">{toolbarLinks}</div>}
        </div>
        {sendMessage}
      </header>

      <div className="layout" onScroll={onPageScroll}>
        <div className="schedule-scroll" data-motion-area>
          <div className="board">{jobRows.map(block)}</div>
          {showNoCrewSection(openJobs, view) && (
            <section className="folded-jobs" aria-labelledby="folded-jobs-heading">
              <header className="folded-jobs-head">
                <h2 id="folded-jobs-heading">{foldedHeading(view.date, scheduleDateOf(new Date()))}</h2>
                {showPutAway(openJobs, view) && (
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
                        className={`button folded-job${inHand ? ' folded-job-target' : ''}`}
                        aria-label={inHand ? `Put ${inHand.crewMember.name} on ${title}` : `Open ${title}`}
                        onClick={() => tapFolded(row)}
                        {...drag.dropProps(row.key)}
                        data-drop-grows
                      >
                        {title}
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
            onAdd={(text) => onEdit({ kind: 'add-day-note', text })}
            onChange={(index, text) => onEdit({ kind: 'change-day-note', index, text })}
            onRemove={(index) => onEdit({ kind: 'remove-day-note', index })}
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

      {bottomBar && <div className="bottom-bar">{bottomBar}</div>}

      {drag.overlay}
      <MoveNames motion={motion} scene={view.date} />
    </main>
  );
}
