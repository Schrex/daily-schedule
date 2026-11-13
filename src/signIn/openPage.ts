import { showPageMessage } from '../pageMessage';
import { browserFetch, type Fetch } from '../storage/apiStore';
import { HUB_HOME, HUB_SIGN_IN } from './hubConfig';
import { hubToken } from './hubSession';
import type { Role } from '../../shared';
import { askWhoIsCalling, openingFor, type Page } from './opening';
import { withToken } from './withToken';

/** The fetch every page uses for the API: it sends the Hub sign-in's token. */
export const signedInFetch: Fetch = withToken(browserFetch, hubToken);

/**
 * Opens a page for whoever is calling (see `openingFor`): `start` runs only
 * when the page is theirs to open, and is told their role. A Viewer on the board or Settings is sent
 * to the Crew Page; anyone else gets a plain message. If anything fails, the
 * page says so (`what`) and is never left blank.
 */
export function openPage(page: Page, what: string, start: (role: Role) => unknown): void {
  askWhoIsCalling(signedInFetch)
    .then(async (caller) => {
      const opening = openingFor(page, caller);
      switch (opening.kind) {
        case 'open':
          // Only someone on the list (an Editor or a Viewer) is let in.
          if (caller.kind === 'on-the-list') await start(caller.role);
          return;
        case 'go-to-crew-page':
          window.location.replace('crew.html');
          return;
        case 'no-access':
          showPageMessage(
            'You don\'t have access to the Daily Schedule',
            'You are signed in to the Hub, but not on the Daily Schedule\'s list. Ask the Scheduler to add you.',
            { href: HUB_HOME, text: 'Back to the Hub' },
          );
          return;
        case 'sign-in':
          showPageMessage(
            'Sign in to see the Daily Schedule',
            'Sign in to the Hub, then come back to this page.',
            { href: HUB_SIGN_IN, text: 'Sign in to the Hub' },
          );
          return;
      }
    })
    .catch((error: unknown) => {
      console.error(what, error);
      showPageMessage(what, error instanceof Error ? error.message : String(error));
    });
}
