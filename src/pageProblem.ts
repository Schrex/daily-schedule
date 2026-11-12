/**
 * Shows a plain message in place of a page that could not open (the server
 * refused or could not be reached), so it is never left blank.
 */
export function showPageProblem(what: string, error: unknown): void {
  console.error(what, error);
  const root = document.getElementById('root');
  if (!root) return;
  const message = document.createElement('p');
  message.className = 'page-problem';
  message.style.cssText = 'font: 18px/1.5 system-ui, sans-serif; margin: 48px auto; max-width: 40em; padding: 0 16px;';
  message.textContent = `${what}: ${error instanceof Error ? error.message : String(error)}`;
  root.replaceChildren(message);
}
