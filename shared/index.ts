/**
 * What the pages (src/) and the Worker (worker/src/) must agree on, kept in
 * one place that both import.
 */

/** Someone on the access list: an Editor changes the Daily Schedule, a Viewer only looks at it. */
export type Role = 'editor' | 'viewer';
