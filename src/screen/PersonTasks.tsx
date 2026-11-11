import { useState } from 'react';
import type { CrewMember } from '../schedule-rules';
import { LineEditor } from './LineEditor';

interface PersonLinesProps {
  crewMember: CrewMember;
  /** Their Note, if any: the soft yellow strip at the foot of the chip. */
  note?: string;
  tasks: string[];
  /** A Person Task was changed; blank text takes it away. */
  onChange: (index: number, text: string) => void;
  onRemove: (index: number) => void;
  /** Their Note is now this text; blank text takes it away. */
  onSetNote: (text: string) => void;
}

/** What is being changed by tapping it: the Note, or a Person Task by its place in the list. */
type Editing = 'note' | number | null;

/**
 * The selected Crew Member's Person Tasks and Note, drawn in their chip just
 * as when not selected, but each with × to take it away, and tapped to
 * change it in place. Clicks here are about them, not a move to this card.
 */
export function PersonLines({ crewMember, note, tasks, onChange, onRemove, onSetNote }: PersonLinesProps) {
  const [editing, setEditing] = useState<Editing>(null);

  const changing = (text: string, label: string, onDone: (text: string) => void, tone?: 'note') => (
    <LineEditor
      initial={text}
      label={label}
      buttonText="Save"
      tone={tone}
      onCommit={(next) => {
        onDone(next);
        setEditing(null);
      }}
      onCancel={() => setEditing(null)}
    />
  );

  /** A line's text, to tap and change, and its ×. */
  const line = (text: string, onEdit: () => void, onTakeAway: () => void) => (
    <>
      <button type="button" className="line-text" aria-label={`Change "${text}"`} onClick={onEdit}>
        {text}
      </button>
      <button type="button" className="line-remove" aria-label={`Remove "${text}"`} onClick={onTakeAway}>
        ×
      </button>
    </>
  );

  return (
    <>
      {tasks.length > 0 && (
        <ul
          className="name-subs name-subs-open"
          aria-label={`Tasks for ${crewMember.name}`}
          onClick={(event) => event.stopPropagation()}
        >
          {tasks.map((task, index) => (
            <li key={index} className={editing === index ? 'name-sub-editing' : 'name-sub'} data-sub={task}>
              {editing === index
                ? changing(task, `Change task for ${crewMember.name}`, (text) => onChange(index, text))
                : line(task, () => setEditing(index), () => onRemove(index))}
            </li>
          ))}
        </ul>
      )}
      {note && (
        <div className="note note-open" onClick={(event) => event.stopPropagation()}>
          {editing === 'note'
            ? changing(note, `Change note for ${crewMember.name}`, onSetNote, 'note')
            : line(note, () => setEditing('note'), () => onSetNote(''))}
        </div>
      )}
    </>
  );
}

interface PersonAddProps {
  crewMember: CrewMember;
  onAddTask: (text: string) => void;
  /** Their Note is now this text. */
  onSetNote: (text: string) => void;
}

/** Under the selected Crew Member's chip: one field ("Task or note") with Add task and Add note. */
export function PersonAdd({ crewMember, onAddTask, onSetNote }: PersonAddProps) {
  return (
    <div className="person-tasks" onClick={(event) => event.stopPropagation()}>
      <LineEditor
        key={crewMember.id}
        initial=""
        label={`Task or note for ${crewMember.name}`}
        placeholder="Task or note"
        buttonText="Add task"
        second={{ text: 'Add note', onCommit: onSetNote }}
        keepOpen
        autoFocus={false}
        onCommit={onAddTask}
      />
    </div>
  );
}
