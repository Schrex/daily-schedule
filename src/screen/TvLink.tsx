/**
 * The TV button in the toolbar, beside Settings at the right end of the
 * header: opens the office TV page (tv.html) in a window of its own, to drag
 * onto the TV and put full screen. It shows today's Daily Schedule (as Sent,
 * if it was) and changes by itself. Its icon with "TV view" (the icon alone
 * on a phone).
 */
export function TvLink() {
  return (
    <a
      className="button toolbar-button toolbar-link tv-link"
      href="tv.html"
      target="daily-schedule-tv"
      aria-label="Show on the office TV"
      title="Show on the office TV: today's schedule, full screen"
    >
      <svg
        className="toolbar-button-svg"
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
      <span className="toolbar-link-label">TV view</span>
    </a>
  );
}
