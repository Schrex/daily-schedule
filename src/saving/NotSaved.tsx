import { useSyncExternalStore } from 'react';
import { HUB_HOME, HUB_SIGN_IN } from '../signIn/hubConfig';
import type { SaveState, Saves } from '../storage/saveQueue';
import './notSaved.css';

/** Where the save queue stands right now (saveQueue.ts), redrawn whenever it changes. */
export function useSaveState(saves: Saves): SaveState {
  return useSyncExternalStore(saves.subscribe, saves.state);
}

/**
 * A red strip while changes are not reaching the server, so the Scheduler
 * knows: "Not saved, trying again" while a save is failing, or a plain message
 * when the server refused it and it is no longer tried (signed out, no access,
 * or a change it would not take). Nothing otherwise (saving normally is too
 * quick to be worth showing).
 */
export function NotSaved({ state }: { state: SaveState }) {
  return (
    <div className="not-saved-message" role="alert">
      {state === 'not-saved' && (
        <p className="not-saved">
          <strong>Not saved, trying again.</strong> Keep this page open until this goes away.
        </p>
      )}
      {state === 'sign-in-again' && (
        <p className="not-saved">
          <strong>Not saved: your sign-in has run out.</strong>{' '}
          <a href={HUB_SIGN_IN}>Sign in to the Hub again</a>, then come back to this page and make the change
          again.
        </p>
      )}
      {state === 'no-access' && (
        <p className="not-saved">
          <strong>Not saved: you can no longer change the Daily Schedule.</strong> Ask the Scheduler to make you an
          Editor, or <a href={HUB_HOME}>go back to the Hub</a>.
        </p>
      )}
      {state === 'refused' && (
        <p className="not-saved">
          <strong>Not saved: the server would not take this change.</strong> Reload the page and make the change
          again.
        </p>
      )}
    </div>
  );
}
