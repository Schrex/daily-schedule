import { useState } from 'react';
import { notePieces, type Roster } from '../schedule-rules';
import { LineEditor } from './LineEditor';

interface DayNotesProps {
  roster: Roster;
  notes: string[];
  onAdd: (text: string) => void;
  /** A Day Note was changed; blank text takes it away. */
  onChange: (index: number, text: string) => void;
  onRemove: (index: number) => void;
}

/**
 * Notes for the day: remarks for everyone, under the Job cards. The Crew
 * Members a note names are marked in yellow and the Jobs in black. Tap a note
 * to change it, × to take it away, "Add a note" for another.
 */
export function DayNotes({ roster, notes, onAdd, onChange, onRemove }: DayNotesProps) {
  /** The note being changed by its place in the list, "new" for one being added, or null. */
  const [editing, setEditing] = useState<number | 'new' | null>(null);

  return (
    <section className="day-notes" aria-labelledby="day-notes-heading">
      <header className="day-notes-head">
        <h2 id="day-notes-heading">Notes for the day</h2>
        <span className="day-notes-hint">Everyone sees these. Names and jobs are marked.</span>
      </header>

      {notes.map((note, index) =>
        editing === index ? (
          <LineEditor
            key={index}
            initial={note}
            label="Change note"
            buttonText="Save"
            onCommit={(text) => {
              onChange(index, text);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div key={index} className="day-note">
            <button
              type="button"
              className="day-note-text"
              aria-label={`Change note: ${note}`}
              onClick={() => setEditing(index)}
            >
              {notePieces(roster, note).map((piece, at) =>
                piece.kind === 'plain' ? (
                  piece.text
                ) : (
                  <span key={at} className={`mark mark-${piece.kind}`}>
                    {piece.text}
                  </span>
                ),
              )}
            </button>
            <button
              type="button"
              className="day-note-remove"
              aria-label={`Remove note: ${note}`}
              onClick={() => onRemove(index)}
            >
              ×
            </button>
          </div>
        ),
      )}

      {editing === 'new' ? (
        <LineEditor
          initial=""
          label="New note for the day"
          placeholder="For example: Brody may have to go to TIUNY after lunch"
          buttonText="Add"
          onCommit={(text) => {
            onAdd(text);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button type="button" className="day-notes-add" onClick={() => setEditing('new')}>
          Add a note
        </button>
      )}
    </section>
  );
}
