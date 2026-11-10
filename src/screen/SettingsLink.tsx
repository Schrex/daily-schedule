/**
 * The Settings button in the toolbar: a plain link to the settings page, where
 * the roster (Crew Members, their colors, and Jobs) is managed. It is a gear
 * alone, so the date and the Scheduler's own buttons keep one line on a small
 * screen. Every change on the Scheduler's screen is already saved, so leaving
 * the page loses nothing.
 */
export function SettingsLink() {
  return (
    <a
      className="button toolbar-button toolbar-button-icon-only"
      href="settings.html"
      aria-label="Settings"
      title="Settings: Crew Members, colors and Jobs"
    >
      <span className="toolbar-button-icon" aria-hidden="true">
        ⚙
      </span>
    </a>
  );
}
