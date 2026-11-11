import { useState, type ReactNode } from 'react';
import type { CrewMember } from '../schedule-rules';
import { LineEditor } from './LineEditor';

interface PersonTasksProps {
  crewMember: CrewMember;
  tasks: string[];
  onAdd: (text: string) => void;
  /** A line was changed; blank text takes it away. */
  onChange: (index: number, text: string) => void;
  onRemove: (index: number) => void;
  /** Drawn on the same line as "Add task": "Add note". */
  beside?: ReactNode;
}

/**
 * What is only about the selected Crew Member, right under their name:
 * their Person Tasks, each one to tap and change or to take away with ×, and
 * a field to add another ("Task for Rob").
 */
export function PersonTasks({ crewMember, tasks, onAdd, onChange, onRemove, beside }: PersonTasksProps) {
  /** The Person Task being changed, by its place in the list. */
  const [editing, setEditing] = useState<number | null>(null);
  const first = crewMember.name.split(' ')[0] ?? crewMember.name;

  return (
    <div className="person-tasks" onClick={(event) => event.stopPropagation()}>
      {tasks.length > 0 && (
        <ul className="person-task-list" aria-label={`Tasks for ${crewMember.name}`}>
          {tasks.map((task, index) =>
            editing === index ? (
              <li key={index}>
                <LineEditor
                  initial={task}
                  label={`Change task for ${crewMember.name}`}
                  buttonText="Save"
                  onCommit={(text) => {
                    onChange(index, text);
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={index} className="person-task">
                <button
                  type="button"
                  className="person-task-text"
                  aria-label={`Change "${task}"`}
                  onClick={() => setEditing(index)}
                >
                  {task}
                </button>
                <button
                  type="button"
                  className="person-task-remove"
                  aria-label={`Remove "${task}"`}
                  onClick={() => onRemove(index)}
                >
                  ×
                </button>
              </li>
            ),
          )}
        </ul>
      )}
      <LineEditor
        key={crewMember.id}
        initial=""
        label={`Task for ${crewMember.name}`}
        placeholder={`Task for ${first}`}
        buttonText="Add"
        keepOpen
        autoFocus={false}
        onCommit={onAdd}
      >
        {beside}
      </LineEditor>
    </div>
  );
}
