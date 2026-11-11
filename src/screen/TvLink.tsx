/**
 * The TV button in the toolbar: opens the office TV page (tv.html) in a window
 * of its own, to drag onto the TV and put full screen. It shows the finished
 * Daily Schedule, the one last Sent, and changes by itself on the next Send.
 */
export function TvLink() {
  return (
    <a
      className="button toolbar-button toolbar-button-icon-only tv-link"
      href="tv.html"
      target="daily-schedule-tv"
      aria-label="Show on the office TV"
      title="Show on the office TV: opens the sent schedule full screen"
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
    </a>
  );
}
