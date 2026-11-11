import { useState } from 'react';

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
}

/**
 * One line of text being typed: a Person Task or a Day Note. The text is kept
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
}: LineEditorProps) {
  const [draft, setDraft] = useState(initial);

  const commit = () => {
    if (keepOpen && draft.trim() === '') return;
    onCommit(draft);
    if (keepOpen) setDraft('');
  };

  return (
    <form
      className="line-editor"
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
    </form>
  );
}
