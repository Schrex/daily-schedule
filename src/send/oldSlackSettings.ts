/**
 * Slack used to be set up in each browser, and the send key was kept in its
 * storage under this name. The server holds it now (worker/src/send.ts), so
 * the board and Settings delete the old entry when they open. It is never
 * read. A browser that will not let its storage be touched is left alone.
 */
const OLD_KEY = 'daily-schedule/slack';

export function forgetOldSlackSettings(storage: () => Storage = () => window.localStorage): void {
  try {
    storage().removeItem(OLD_KEY);
  } catch {
    // Storage is switched off or blocked: there is nothing to delete, or no way to.
  }
}
