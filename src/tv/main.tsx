import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyPalette } from '../palette';
import { browserStore } from '../storage/browserStore';
import { TvPage } from './TvPage';
import './tv.css';

applyPalette();

// The office TV: its own address (tv.html), opened from the TV button on the
// Scheduler's screen and put on the TV full screen. It only reads the store
// the Scheduler's screen saves to, so it must be open in the same browser on
// the same computer (a TV plugged in as a second screen, or the tab cast to it).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TvPage store={browserStore()} />
  </StrictMode>,
);
