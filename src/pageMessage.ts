/**
 * A plain message in place of a page that is not opening (no access, not
 * signed in, or the server refused or could not be reached), so the page is
 * never left blank: a heading, a sentence, and at most one link.
 */
export function showPageMessage(title: string, text: string, link?: { href: string; text: string }): void {
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
  box.append(heading, paragraph);
  if (link) {
    const anchor = document.createElement('a');
    anchor.href = link.href;
    anchor.textContent = link.text;
    box.append(anchor);
  }
  root.replaceChildren(box);
}
