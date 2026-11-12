import { showPageProblem } from '../pageProblem';
import type { Fetch } from '../storage/apiStore';
import { HUB_HOME, HUB_SIGN_IN } from './hubConfig';
import { hubToken } from './hubSession';
import { askWhoIsCalling, openingFor, type Page } from './opening';
import { withToken } from './withToken';

/** The fetch every page uses for the API: it sends the hub sign-in's token. */
export const signedInFetch: Fetch = withToken((input, init) => fetch(input, init), hubToken);

/**
 * Opens a page for whoever is calling (see `openingFor`): `start` runs only
 * when the page is theirs to open. A viewer on the board or Settings is sent
 * to the Office TV; anyone else gets a plain message. If anything fails, the
 * page says so (`what`) and is never left blank.
 */
export function openPage(page: Page, what: string, start: () => unknown): void {
  askWhoIsCalling(signedInFetch)
    .then(async (caller) => {
      const opening = openingFor(page, caller);
      switch (opening.kind) {
        case 'open':
          await start();
          return;
        case 'go-to-tv':
          window.location.replace('tv.html');
          return;
        case 'no-access':
          showPageMessage(
            'You don\'t have access to the Daily Schedule',
            'You are signed in to the hub, but not on the Daily Schedule\'s list. Ask the Scheduler to add you.',
            { href: HUB_HOME, text: 'Back to the hub' },
          );
          return;
        case 'sign-in':
          showPageMessage(
            'Sign in to see the Daily Schedule',
            'Sign in to the hub, then come back to this page.',
            { href: HUB_SIGN_IN, text: 'Sign in to the hub' },
          );
          return;
      }
    })
    .catch((error: unknown) => showPageProblem(what, error));
}

/** A plain message in place of the page, with one link. */
function showPageMessage(title: string, text: string, link: { href: string; text: string }): void {
  const root = document.getElementById('root');
  if (!root) return;
  const box = document.createElement('div');
  box.className = 'page-message';
  box.style.cssText = 'font: 18px/1.5 system-ui, sans-serif; margin: 48px auto; max-width: 40em; padding: 0 16px;';
  const heading = document.createElement('h1');
  heading.style.cssText = 'font-size: 24px;';
  heading.textContent = title;
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  const anchor = document.createElement('a');
  anchor.href = link.href;
  anchor.textContent = link.text;
  box.append(heading, paragraph, anchor);
  root.replaceChildren(box);
}
