import { useState } from 'react';
import type { CrewMember } from '../schedule-rules';
import { LineEditor } from './LineEditor';

interface PersonTasksProps {
  crewMember: CrewMember;
  /** Their Note, if any: one short line in red. */
  note?: string;
  tasks: string[];
  onAdd: (text: string) => void;
  /** A line was changed; blank text takes it away. */
  onChange: (index: number, text: string) => void;
  onRemove: (index: number) => void;
  /** Their Note is now this text; blank text takes it away. */
  onSetNote: (text: string) => void;
}

/** What is being changed by tapping it: the Note, or a Person Task by its place in the list. */
type Editing = 'note' | number | null;

/**
 * What is only about the selected Crew Member, right under their name: their
 * Note (in red) and their Person Tasks, each one to tap and change or to take
 * away with ×, and one field ("Task or note") with Add task and Add note.
 */
export function PersonTasks({ crewMember, note, tasks, onAdd, onChange, onRemove, onSetNote }: PersonTasksProps) {
  const [editing, setEditing] = useState<Editing>(null);

  /** One line: its text to tap and change, and × to take it away. */
  const line = (key: string, text: string, onEdit: () => void, onTakeAway: () => void, isNote = false) => (
    <li key={key} className={`person-task${isNote ? ' person-task-note' : ''}`}>
      <button type="button" className="person-task-text" aria-label={`Change "${text}"`} onClick={onEdit}>
        {text}
      </button>
      <button type="button" className="person-task-remove" aria-label={`Remove "${text}"`} onClick={onTakeAway}>
        ×
      </button>
    </li>
  );

  /** A line being changed in place. */
  const changing = (key: string, text: string, label: string, onDone: (text: string) => void, isNote = false) => (
    <li key={key}>
      <LineEditor
        initial={text}
        label={label}
        buttonText="Save"
        tone={isNote ? 'note' : undefined}
        onCommit={(next) => {
          onDone(next);
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
      />
    </li>
  );

  return (
    <div className="person-tasks" onClick={(event) => event.stopPropagation()}>
      {(note || tasks.length > 0) && (
        <ul className="person-task-list" aria-label={`Note and tasks for ${crewMember.name}`}>
          {note &&
            (editing === 'note'
              ? changing('note', note, `Change note for ${crewMember.name}`, onSetNote, true)
              : line('note', note, () => setEditing('note'), () => onSetNote(''), true))}
          {tasks.map((task, index) =>
            editing === index
              ? changing(`task-${index}`, task, `Change task for ${crewMember.name}`, (text) => onChange(index, text))
              : line(`task-${index}`, task, () => setEditing(index), () => onRemove(index)),
          )}
        </ul>
      )}
      <LineEditor
        key={crewMember.id}
        initial=""
        label={`Task or note for ${crewMember.name}`}
        placeholder="Task or note"
        buttonText="Add task"
        second={{ text: 'Add note', onCommit: onSetNote }}
        keepOpen
        autoFocus={false}
        onCommit={onAdd}
      />
    </div>
  );
}
