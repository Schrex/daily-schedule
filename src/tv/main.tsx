import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyPalette } from '../palette';
import { openPage, signedInFetch } from '../signIn/openPage';
import { TvPage } from './TvPage';
import './tv.css';

applyPalette();

// The office TV: its own address (tv.html), opened from the TV button on the
// Scheduler's screen and put on the TV full screen. It asks the server only
// for what has been Sent (the API's /crew-page), as the Crew Page does, so
// any computer can show it; it looks again every minute. Editors and Viewers
// both open it; only Editors get the way back to the board.

openPage('tv', 'Could not open the Office TV', (role) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <TvPage fetchFn={signedInFetch} boardLink={role === 'editor'} />
    </StrictMode>,
  );
});
