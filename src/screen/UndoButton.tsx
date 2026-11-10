import './undo.css';

/**
 * The Undo button: large, always in the same place, and greyed out when there
 * is nothing to undo. It only reports the click; the schedule rules do the undoing.
 */
export function UndoButton({ canUndo, onUndo }: { canUndo: boolean; onUndo: () => void }) {
  return (
    <button
      type="button"
      className="undo"
      disabled={!canUndo}
      title={canUndo ? 'Take back your last change' : 'Nothing to undo'}
      onClick={onUndo}
    >
      <span className="undo-arrow" aria-hidden="true">
        ↶
      </span>
      Undo
    </button>
  );
}
