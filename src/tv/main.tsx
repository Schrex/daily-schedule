import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyPalette } from '../palette';
import { apiStore } from '../storage/apiStore';
import { TvPage } from './TvPage';
import './tv.css';

applyPalette();

// The office TV: its own address (tv.html), opened from the TV button on the
// Scheduler's screen and put on the TV full screen. It only reads the store
// the Scheduler's screen saves to (the Worker's database), so any computer
// can show it; it looks again every minute.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TvPage store={apiStore()} />
  </StrictMode>,
);
