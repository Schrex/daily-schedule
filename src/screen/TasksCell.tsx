import { useState } from 'react';
import { tasksText } from '../schedule-rules';

interface TasksCellProps {
  /** The Job as written on the Daily Schedule, for the field's spoken label. */
  jobLabel: string;
  /** The small label over the Tasks: "Wednesday's work". */
  heading: string;
  tasks: string[];
  /** False while a Crew Member is being moved: the click then belongs to the move. */
  canEdit: boolean;
  /** The Scheduler left the field. Called once per edit, with the whole text. */
  onCommit: (text: string) => void;
}

/**
 * A Job's Tasks, in a tinted box under the Job: a small label, then one Task
 * to a line, each with a square bullet. Click to type, one Task per line. The text being typed is kept
 * here and handed over once, when the Scheduler leaves the field, so one edit
 * is one change to the Daily Schedule, not one per key.
 */
export function TasksCell({ jobLabel, heading, tasks, canEdit, onCommit }: TasksCellProps) {
  /** The text being typed, or null when not typing. */
  const [draft, setDraft] = useState<string | null>(null);

  const lines = (
    <>
      <span className="tasks-heading">{heading}</span>
      {tasks.map((task, index) => (
        <span key={index} className="task">
          <span className="task-bullet" aria-hidden="true" />
          <span>{task}</span>
        </span>
      ))}
    </>
  );

  if (!canEdit) return tasks.length > 0 ? <div className="tasks-box tasks-shown">{lines}</div> : null;

  if (draft === null) {
    return (
      <button
        type="button"
        className={tasks.length > 0 ? 'tasks-box tasks-open' : 'tasks-open tasks-open-empty'}
        aria-label={`Tasks for ${jobLabel}. Click to type.`}
        onClick={() => setDraft(tasksText(tasks))}
      >
        {tasks.length > 0 ? lines : (
          <span className="tasks-empty">
            <span className="on-wide">+ Click to type tasks</span>
            <span className="on-narrow">+ Tap to type tasks</span>
          </span>
        )}
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
