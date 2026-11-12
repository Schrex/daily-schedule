/**
 * What the pages (src/) and the Worker (worker/src/) must agree on, kept in
 * one place that both import.
 */

/** Someone on the access list: an Editor changes the Daily Schedule, a Viewer only looks at it. */
export type Role = 'editor' | 'viewer';

/** Which file an Export file is, so an unrelated JSON file is never uploaded. */
export const EXPORT_FILE_KIND = 'daily-schedule-export';

/** The Export file's format version; a page or Worker refuses one it doesn't know. */
export const EXPORT_FILE_VERSION = 1;

/** What a page or the Worker says about a file that is not an Export file. */
export const NOT_AN_EXPORT_FILE = 'That is not a Daily Schedule Export file.';
