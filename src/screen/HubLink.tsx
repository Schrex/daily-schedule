import { HUB_HOME } from '../signIn/hubConfig';

/**
 * The way back to the hub, at the right end of the header beside TV and
 * Settings: a house alone, named by its tooltip and for screen readers. Every
 * change is already saved, so leaving loses nothing.
 */
export function HubLink() {
  return (
    <a
      className="button toolbar-button toolbar-icon hub-link"
      href={HUB_HOME}
      aria-label="Back to the Hub"
      title="Back to the Hub"
    >
      <svg
        className="toolbar-button-svg"
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 11l9-7 9 7" />
        <path d="M5 10v10h14V10" />
        <path d="M10 20v-6h4v6" />
      </svg>
    </a>
  );
}
