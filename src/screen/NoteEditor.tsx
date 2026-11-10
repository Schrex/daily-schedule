import { useState } from 'react';

interface NoteEditorProps {
  crewMemberName: string;
  /** The Note the Placement has now, if any. */
  note: string | undefined;
  /** "Save note" was clicked (or Enter pressed). Called once, with the whole text. */
  onSave: (text: string) => void;
  onClear: () => void;
  onCancel: () => void;
}

/**
 * Typing a Note for one Crew Member's Placement. The text being typed is kept
 * here and handed over once, on "Save note", so one edit is one change to the
 * Daily Schedule (and later one Undo step), not one per key.
 */
export function NoteEditor({ crewMemberName, note, onSave, onClear, onCancel }: NoteEditorProps) {
  const [draft, setDraft] = useState(note ?? '');

  return (
    <form
      className="note-editor"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <label className="note-editor-label">
        <span>
          Note for <strong>{crewMemberName}</strong>:
        </span>
        <input
          className="note-input"
          type="text"
          autoFocus
          maxLength={40}
          placeholder="for example: 1/2 Day"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => event.target.select()}
        />
      </label>
      <button type="submit" className="button button-primary action action-main">
        Save note
      </button>
      {note && (
        <button type="button" className="button action" onClick={onClear}>
          Remove note
        </button>
      )}
      <button type="button" className="button action" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}
