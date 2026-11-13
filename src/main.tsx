import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyPalette } from './palette';
import { scheduleDateOf } from './schedule-rules';
import { App } from './screen/App';
import { seedRoster } from './seed/seedRoster';
import { seedSchedule } from './seed/seedSchedule';
import { crewDelivery } from './send/serverDelivery';
import { sharedStore } from './sharedStore';
import { openStore } from './storage';
import { openPage, signedInFetch } from './signIn/openPage';
import './screen/screen.css';

applyPalette();

// The shared store (sharedStore.ts). On first ever open it is filled from the
// seed roster and seed Daily Schedule.
const { store, saves } = sharedStore();

// It opens on the Daily Schedule for the next working day after today.
const today = scheduleDateOf(new Date());

// Only an Editor opens it (and so only an Editor ever creates or saves
// anything); a Viewer is sent to the Crew Page.
//
// Send goes through the server to the Slack channel, the same on every
// device; only when Slack is not connected on the server is the picture
// copied for the Scheduler to paste (send/serverDelivery.ts).
openPage('board', 'Could not open the Daily Schedule', () =>
  Promise.all([
    openStore(store, { roster: seedRoster, schedule: seedSchedule }, today),
    crewDelivery(signedInFetch),
  ]).then(([opened, delivery]) => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App store={store} saves={saves} opened={opened} delivery={delivery} />
      </StrictMode>,
    );
  }),
);
