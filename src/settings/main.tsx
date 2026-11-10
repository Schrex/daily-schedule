import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyPalette } from '../palette';
import { seedRoster } from '../seed/seedRoster';
import { browserStore } from '../storage/browserStore';
import '../screen/screen.css'; // the Crew Member name cells, so they match the Daily Schedule
import './settings.css';
import { SettingsPage } from './SettingsPage';

applyPalette();

// The settings page: its own address (settings.html), used by the office and
// not linked from the Scheduler's screen. It reads and saves the roster in the
// same store, so the Scheduler's screen has the changes the next time it loads.
const store = browserStore();

store.loadRoster().then((saved) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {/* Nothing saved yet means the Scheduler's screen was never opened: start from the seed roster. */}
      <SettingsPage store={store} roster={saved ?? seedRoster} />
    </StrictMode>,
  );
});
