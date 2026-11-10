import { useState } from 'react';
import { tasksText } from '../schedule-rules';

interface TasksCellProps {
  /** The Job as written on the Daily Schedule, for the field's spoken label. */
  jobLabel: string;
  tasks: string[];
  /** False while a Crew Member is being moved: the click then belongs to the move. */
  canEdit: boolean;
  /** The Scheduler left the field. Called once per edit, with the whole text. */
  onCommit: (text: string) => void;
}

/**
 * A Job's Tasks. Click to type, one Task per line. The text being typed is kept
 * here and handed over once, when the Scheduler leaves the field, so one edit
 * is one change to the Daily Schedule (and later one Undo step), not one per key.
 */
export function TasksCell({ jobLabel, tasks, canEdit, onCommit }: TasksCellProps) {
  /** The text being typed, or null when not typing. */
  const [draft, setDraft] = useState<string | null>(null);

  const lines = tasks.map((task, index) => (
    <div key={index} className="task">
      {task}
    </div>
  ));

  if (!canEdit) return <div className="tasks-shown">{lines}</div>;

  if (draft === null) {
    return (
      <button
        type="button"
        className="tasks-open"
        aria-label={`Tasks for ${jobLabel}. Click to type.`}
        onClick={() => setDraft(tasksText(tasks))}
      >
        {tasks.length > 0 ? lines : <span className="tasks-empty">Click here to type tasks</span>}
      </button>
    );
  }

  return (
    <div className="tasks-editing">
      <textarea
        className="tasks-input"
        aria-label={`Tasks for ${jobLabel}, one per line`}
        autoFocus
        rows={Math.max(3, draft.split('\n').length + 1)}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => {
          const end = event.target.value.length;
          event.target.setSelectionRange(end, end);
        }}
        onBlur={() => {
          onCommit(draft);
          setDraft(null);
        }}
      />
      <div className="tasks-editing-foot">
        <span>One task on each line.</span>
        {/* Leaving the field is what keeps the text; this button is somewhere obvious to click. */}
        <button type="button" className="button action">
          Done
        </button>
      </div>
    </div>
  );
}
