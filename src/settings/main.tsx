import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyPalette } from '../palette';
import { seedRoster } from '../seed/seedRoster';
import { openPage, signedInFetch } from '../signIn/openPage';
import { API_BASE, apiStore } from '../storage/apiStore';
import '../look.css'; // the look of the Scheduler's screen, Crew Member colors and all
import './settings.css';
import { SettingsPage } from './SettingsPage';

applyPalette();

// The settings page: its own address (settings.html), reached from the Settings
// button on the Scheduler's screen. It reads and saves the roster in the
// same store (the Worker's database), so every screen has the changes the
// next time it loads.
const store = apiStore(API_BASE, signedInFetch);

// Only an editor opens it; a viewer is sent to the Office TV.
openPage('settings', 'Could not open Settings', () =>
  store.loadRoster().then((saved) => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        {/* Nothing saved yet means the Scheduler's screen was never opened: start from the seed roster. */}
        <SettingsPage store={store} roster={saved ?? seedRoster} />
      </StrictMode>,
    );
  }),
);
