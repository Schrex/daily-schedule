import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyPalette } from './palette';
import { scheduleDateOf } from './schedule-rules';
import { App } from './screen/App';
import { seedRoster } from './seed/seedRoster';
import { seedSchedule } from './seed/seedSchedule';
import { clipboardDelivery } from './send/clipboardDelivery';
import { slackDelivery } from './send/slackDelivery';
import { loadSlackSettings, slackIsSetUp } from './send/slackSettings';
import { showPageProblem } from './pageProblem';
import { openStore } from './storage';
import { apiStore } from './storage/apiStore';
import './screen/screen.css';

applyPalette();

// The one place that chooses where things are saved: the Worker's database,
// shared by every screen. On first ever open the store is filled from the seed
// roster and seed Daily Schedule.
const store = apiStore();

// It opens on the Daily Schedule for the next working day after today.
const today = scheduleDateOf(new Date());

// Send goes straight to the Slack channel once Slack is set up in Settings;
// until then the picture is copied for the Scheduler to paste.
const slack = loadSlackSettings();
const delivery = slackIsSetUp(slack) ? slackDelivery(slack) : clipboardDelivery();

openStore(store, { roster: seedRoster, schedule: seedSchedule }, today).then(
  (opened) => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App store={store} opened={opened} delivery={delivery} />
      </StrictMode>,
    );
  },
  (error) => showPageProblem('Could not open the Daily Schedule', error),
);
