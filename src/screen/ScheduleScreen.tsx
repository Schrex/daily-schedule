import { useState, type MouseEvent, type ReactNode } from 'react';
import {
  fullDate,
  scheduleView,
  type CrewMember,
  type DailySchedule,
  type Destination,
  type Roster,
} from '../schedule-rules';
import { NOT_PLACED_DROP } from './drag/nameDrag';
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
  /** A Job or Standing Row block was clicked while a Crew Member is selected. */
  onPlace: (destination: Destination) => void;
  /** The Not Placed list was clicked while a Crew Member is selected. */
  onReturnToNotPlaced: () => void;
  /** A dragged name was dropped on a Job or Standing Row, or on the Not Placed list. */
  onDrop: (crewMemberId: string, to: Destination | 'not-placed') => void;
  /** A name was double-clicked: that Crew Member is to go to the Not Placed list. */
  onSetAside: (crewMemberId: string) => void;
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
  /** Drawn in the toolbar, to the right of the date: Undo and Change date. */
  toolbarButtons?: ReactNode;
  /** Drawn under the schedule: the Send bar. */
  footer?: ReactNode;
}

/**
 * The Scheduler's screen. Thin: it asks the schedule rules for the view, draws
 * it, and reports clicks. It applies no rule (ordering, Not Placed, ...) itself.
 *
 * Moving is click-click: click a name to select it, then click a Job, a
 * Standing Row or the Not Placed list. While a name is selected, a click
 * anywhere in one of those blocks (even on another name) is the destination.
 *
 * Double-clicking a name sets that Crew Member aside, in the Not Placed list.
 * The browser reports a double-click as two clicks and then the double-click,
 * so the name is selected and let go of first.
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
 * It is one screen: the toolbar (date, Undo, Change date and the hint) and the
 * Send bar stay put, and only the table scrolls, beside the Not Placed list.
 */
export function ScheduleScreen({
  roster,
  schedule,
  selectedCrewMemberId,
  onSelectCrewMember,
  onDeselect,
  onPlace,
  onReturnToNotPlaced,
  onDrop,
  onSetAside,
  editingNote,
  onEditNote,
  onSaveNote,
  onClearNote,
  onSetTasks,
  alertNotPlaced = false,
  toolbarButtons,
  footer,
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
      if (to !== null) onDrop(crewMemberId, to);
    },
    onLetGo: motion.letGoAt,
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

  const name = (crewMember: CrewMember) => (
    <button
      type="button"
      className={`name color-${crewMember.color}${
        crewMember.id === selected?.id ? ' name-selected' : ''
      }`}
      aria-pressed={crewMember.id === selected?.id}
      onClick={(event) => onNameClick(crewMember, event)}
      {...drag.nameProps(crewMember.id)}
      onDoubleClick={() => onSetAside(crewMember.id)}
    >
      {crewMember.name}
    </button>
  );

  return (
    <main className={`screen${moving ? ' moving' : ''}`}>
      <header className="toolbar">
        <h1 className="date-heading">{fullDate(view.date)}</h1>
        {toolbarButtons}

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
                Moving <strong>{selected.name}</strong>. Now click where they go.
                <span className="move-hint-cancel"> (Click the name again to cancel.)</span>
              </span>
              {selectedPlaced && (
                <button type="button" className="button action" onClick={onEditNote}>
                  {selectedPlaced.note ? 'Change note' : 'Add note'}
                </button>
              )}
            </>
          ) : (
            'To move someone, drag their name, or click it. To change tasks, click the tasks.'
          )}
        </div>
      </header>

      <div className="layout">
        <div className="schedule-scroll" data-motion-area>
          <table className="schedule">
            <thead>
              <tr>
                <th className="col-job">JOB</th>
                <th className="col-tasks">TASKS</th>
                <th className="col-who">WHO</th>
              </tr>
            </thead>
            <tbody>
              {shown.rows.map(({ destination, ...row }) => (
                <tr
                  key={row.key}
                  className={`row row-${destination.kind} destination`}
                  data-row={row.key}
                  onClick={moving ? () => onPlace(destination) : undefined}
                  {...drag.dropProps(row.key)}
                >
                  <th scope="row" className="job">
                    {row.label}
                  </th>
                  <td className="tasks">
                    {destination.kind === 'job' && (
                      <TasksCell
                        jobLabel={row.label}
                        tasks={row.tasks}
                        canEdit={!moving}
                        onCommit={(text) => onSetTasks(destination.jobId, text)}
                      />
                    )}
                  </td>
                  <td className="who">
                    <ul className="names">
                      {row.who.map(({ crewMember, note }) => (
                        <li key={crewMember.id}>
                          {name(crewMember)}
                          {note && <span className="note">{note}</span>}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside
          className={`not-placed destination${alertNotPlaced ? ' not-placed-alert' : ''}`}
          aria-labelledby="not-placed-heading"
          onClick={moving ? onReturnToNotPlaced : undefined}
          data-motion-area
          {...drag.dropProps(NOT_PLACED_DROP)}
        >
          <h2 id="not-placed-heading">NOT PLACED</h2>
          {shown.notPlaced.length === 0 ? (
            <p className="not-placed-empty">Everyone is placed.</p>
          ) : (
            <ul className="names names-stacked">
              {shown.notPlaced.map((crewMember) => (
                <li key={crewMember.id}>{name(crewMember)}</li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {footer}
      {drag.overlay}
      <MoveNames motion={motion} scene={view.date} />
    </main>
  );
}
