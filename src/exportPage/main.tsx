import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyPalette } from '../palette';
import { browserStore } from '../storage/browserStore';
import { loadSlackSettings } from '../send/slackSettings';
import '../look.css';
import '../settings/settings.css';
import { ExportPage } from './ExportPage';

applyPalette();

// The export page: the only page on the old address
// (daily-schedule.schrex.workers.dev). It needs no sign-in: it reads this
// address's browser storage, where the Daily Schedule was kept before the move.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ExportPage store={browserStore()} slack={loadSlackSettings()} />
  </StrictMode>,
);
