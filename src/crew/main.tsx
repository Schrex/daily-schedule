import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyPalette } from '../palette';
import { sharedStore } from '../sharedStore';
import { openPage } from '../signIn/openPage';
import { CrewPage } from './CrewPage';
import './crew.css';

applyPalette();

// The Crew Page: its own address (crew.html), where a Viewer who opens the
// board or Settings is sent. It only reads the store the Scheduler's screen
// saves to (the Worker's database) and never saves or creates anything.
// Editors may open it too.
const { store, saves } = sharedStore();

openPage('crew', 'Could not open the Daily Schedule', () => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <CrewPage store={store} saves={saves} />
    </StrictMode>,
  );
});
