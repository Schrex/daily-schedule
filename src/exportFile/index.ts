/**
 * The Export file: the one-time file that carries a computer's saved
 * schedules (the Roster and every Daily Schedule) and its Slack settings from
 * the old address to the new one.
 *
 * At the old address, `exportFrom` reads the browser storage (browserStore)
 * and the export page downloads the result, as a backup of that computer's
 * data. The new address no longer uploads it: the data there is entered in
 * the app itself.
 */

import type { DailySchedule, Roster } from '../schedule-rules';
import type { SlackSettings } from '../send/slackSettings';
import type { ScheduleStore } from '../storage';

/** Which file an Export file is, so it's never mistaken for an unrelated JSON file. */
export const EXPORT_FILE_KIND = 'daily-schedule-export';

/** The Export file's format version. */
export const EXPORT_FILE_VERSION = 1;

export interface ExportFile {
  kind: typeof EXPORT_FILE_KIND;
  version: typeof EXPORT_FILE_VERSION;
  /** Null when the old address never saved one. */
  roster: Roster | null;
  /** Every saved Daily Schedule, earliest first. */
  schedules: DailySchedule[];
  slack: SlackSettings;
}

/** Everything saved in `store`, with the Slack settings, as an Export file. */
export async function exportFrom(store: ScheduleStore, slack: SlackSettings): Promise<ExportFile> {
  const schedules: DailySchedule[] = [];
  for (const date of await store.listScheduleDates()) {
    const schedule = await store.loadSchedule(date);
    if (schedule !== null) schedules.push(schedule);
  }
  return { kind: EXPORT_FILE_KIND, version: EXPORT_FILE_VERSION, roster: await store.loadRoster(), schedules, slack };
}

/** The file name the export page downloads, e.g. daily-schedule-2026-11-12.json. */
export const exportFileName = (today: string) => `daily-schedule-${today}.json`;
