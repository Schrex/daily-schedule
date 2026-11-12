import { useSyncExternalStore } from 'react';
import type { SaveState, Saves } from '../storage/saveQueue';
import './notSaved.css';

/** Where the save queue stands right now (saveQueue.ts), redrawn whenever it changes. */
export function useSaveState(saves: Saves): SaveState {
  return useSyncExternalStore(saves.subscribe, saves.state);
}

/**
 * "Not saved, trying again": a red strip while a save is failing, so the
 * Scheduler knows a change has not reached the server yet. Nothing otherwise
 * (saving normally is too quick to be worth showing).
 */
export function NotSaved({ state }: { state: SaveState }) {
  return (
    <div className="not-saved-message" role="alert">
      {state === 'not-saved' && (
        <p className="not-saved">
          <strong>Not saved, trying again.</strong> Keep this page open until this goes away.
        </p>
      )}
    </div>
  );
}
