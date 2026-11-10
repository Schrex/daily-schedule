/**
 * The Undo button: large, always in the same place in the toolbar, and greyed
 * out when there is nothing to undo. It only reports the click; the schedule
 * rules do the undoing.
 */
export function UndoButton({ canUndo, onUndo }: { canUndo: boolean; onUndo: () => void }) {
  return (
    <button
      type="button"
      className="button toolbar-button"
      disabled={!canUndo}
      title={canUndo ? 'Take back your last change' : 'Nothing to undo'}
      onClick={onUndo}
    >
      <span className="toolbar-button-icon" aria-hidden="true">
        ↶
      </span>
      Undo
    </button>
  );
}
