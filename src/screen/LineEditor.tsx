import { useState, type ReactNode } from 'react';

interface LineEditorProps {
  /** The text to start from: the line being changed, or empty for a new one. */
  initial: string;
  label: string;
  placeholder?: string;
  /** The words on the button beside the field: "Add task", "Save". */
  buttonText: string;
  /** Typing is finished (Enter, the button, or leaving the field): the whole text, once. */
  onCommit: (text: string) => void;
  /** Escape: drop what was typed. */
  onCancel?: () => void;
  /** A new line keeps the field open and empty after each one, for the next. */
  keepOpen?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  /** "note": the text in the dark ink of a Note. */
  tone?: 'note';
  /**
   * A second button after the first, handing the same text to another
   * place: "Add note" beside "Add task".
   */
  second?: { text: string; onCommit: (text: string) => void };
  /** Drawn after the buttons, on the same line: "Cancel". */
  children?: ReactNode;
}

/**
 * One line of text being typed: a Person Task, a Note or a Day Note. The text is kept
 * here and handed over once, so one line is one change to the Daily Schedule,
 * not one per key. Clicks inside it stay inside it: on a card they are not a
 * click on the card (which would move the selected Crew Member there).
 */
export function LineEditor({
  initial,
  label,
  placeholder,
  buttonText,
  onCommit,
  onCancel,
  keepOpen = false,
  autoFocus = true,
  maxLength,
  tone,
  second,
  children,
}: LineEditorProps) {
  const [draft, setDraft] = useState(initial);

  const commit = (to: (text: string) => void = onCommit) => {
    if (keepOpen && draft.trim() === '') return;
    to(draft);
    if (keepOpen) setDraft('');
  };

  return (
    <form
      className={`line-editor${tone ? ` line-editor-${tone}` : ''}`}
      onClick={(event) => event.stopPropagation()}
      onSubmit={(event) => {
        event.preventDefault();
        commit();
      }}
    >
      <input
        className="line-input"
        type="text"
        aria-label={label}
        placeholder={placeholder}
        autoFocus={autoFocus}
        maxLength={maxLength}
        onFocus={(event) => event.target.select()}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && onCancel) {
            event.stopPropagation();
            onCancel();
          }
        }}
        onBlur={(event) => {
          // Leaving for the button beside it is not leaving: the button commits.
          if (event.relatedTarget instanceof Node && event.currentTarget.form?.contains(event.relatedTarget)) {
            return;
          }
          if (!keepOpen) onCommit(draft);
        }}
      />
      <button type="submit" className="button button-primary line-button">
        {buttonText}
      </button>
      {second && (
        <button type="button" className="button line-button" onClick={() => commit(second.onCommit)}>
          {second.text}
        </button>
      )}
      {children}
    </form>
  );
}
