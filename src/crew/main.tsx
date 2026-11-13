import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyPalette } from '../palette';
import { openPage, signedInFetch } from '../signIn/openPage';
import { CrewPage } from './CrewPage';
import './crew.css';

applyPalette();

// The Crew Page: its own address (crew.html), where a Viewer who opens the
// board or Settings is sent. It asks the server only for what has been Sent
// (the API's /crew-page) and never saves or creates anything. Editors may
// open it too.
openPage('crew', 'Could not open the Daily Schedule', () => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <CrewPage fetchFn={signedInFetch} />
    </StrictMode>,
  );
});
