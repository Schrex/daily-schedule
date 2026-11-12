/**
 * The Settings button in the toolbar: a plain link to the settings page, where
 * the roster (Crew Members, their colors, and Jobs) and Slack are managed. It
 * sits at the right end of the header with the TV button, where settings are
 * looked for, its icon with the word "Settings" (the icon alone on a phone).
 * Every change on the Scheduler's screen is already saved, so leaving the page
 * loses nothing.
 */
export function SettingsLink() {
  return (
    <a
      className="button toolbar-button toolbar-link settings-link"
      href="settings.html"
      aria-label="Settings"
      title="Settings: Crew Members, colors and Jobs"
    >
      <svg
        className="toolbar-button-svg"
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4" />
        <circle cx="16" cy="6" r="2" />
        <circle cx="8" cy="12" r="2" />
        <circle cx="14" cy="18" r="2" />
      </svg>
      <span className="toolbar-link-label">Settings</span>
    </a>
  );
}
