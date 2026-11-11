import { useState } from 'react';
import type { CrewMember } from '../schedule-rules';
import { LineEditor } from './LineEditor';

interface PersonTasksProps {
  crewMember: CrewMember;
  tasks: string[];
  onAdd: (text: string) => void;
  /** A line was changed; blank text takes it away. */
  onChange: (index: number, text: string) => void;
  onRemove: (index: number) => void;
}

/**
 * What is only about the selected Crew Member, at the foot of their card:
 * their Person Tasks, each one to tap and change or to take away with ×, and
 * a field to add another ("Task for Rob, with a time if needed").
 */
export function PersonTasks({ crewMember, tasks, onAdd, onChange, onRemove }: PersonTasksProps) {
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
        placeholder={`Task for ${first}, with a time if needed`}
        buttonText="Add task"
        keepOpen
        autoFocus={false}
        onCommit={onAdd}
      />
    </div>
  );
}
