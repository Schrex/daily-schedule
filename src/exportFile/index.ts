/**
 * The Export file: the one-time file that carries a computer's saved
 * schedules (the Roster and every Daily Schedule) and its Slack settings from
 * the old address to the new one.
 *
 * At the old address, `exportFrom` reads the browser storage (browserStore)
 * and the export page downloads the result. At the new address,
 * `uploadExportFile` sends the Roster and Daily Schedules to the Worker
 * (`POST /api/import`, worker/src/import.ts), which replaces everything saved
 * there, and saves the Slack settings into that address's browser storage.
 * The Slack settings never go to the server.
 */

import { EXPORT_FILE_KIND, EXPORT_FILE_VERSION, NOT_AN_EXPORT_FILE } from '../../shared';
import type { DailySchedule, Roster } from '../schedule-rules';
import { saveSlackSettings, slackIsSetUp, type SlackSettings } from '../send/slackSettings';
import { API_BASE, apiRequest, browserFetch, type Fetch } from '../storage/apiStore';
import type { ScheduleStore } from '../storage';

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

export interface UploadOptions {
  /** Where the API answers (the pages' own address by default). */
  base?: string;
  fetch?: Fetch;
  /** The new address's browser storage, for the Slack settings. */
  storage?: Storage;
}

/** What the upload saved. */
export interface Uploaded {
  /** How many Daily Schedules were saved (the Roster is always replaced). */
  schedules: number;
}

/**
 * Uploads an Export file's text to the new address: the Worker replaces the
 * Roster and every Daily Schedule, then the Slack settings are saved here.
 * Rejects with an ApiError (409 once a Daily Schedule has a Send recorded),
 * or an Error for a file that isn't an Export file; nothing is changed then.
 */
export async function uploadExportFile(text: string, options: UploadOptions = {}): Promise<Uploaded> {
  const { base = API_BASE, fetch: fetchFn = browserFetch } = options;
  const file = readExportFile(text);

  const response = await apiRequest(fetchFn, `${base}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // The Slack settings (with the send key) stay in the browser.
    body: JSON.stringify({ kind: file.kind, version: file.version, roster: file.roster, schedules: file.schedules }),
  });
  const answer = (await response.json().catch(() => null)) as { schedules?: number } | null;

  if (slackIsSetUp(file.slack)) saveSlackSettings(file.slack, options.storage ?? window.localStorage);
  return { schedules: answer?.schedules ?? file.schedules.length };
}

function readExportFile(text: string): ExportFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(NOT_AN_EXPORT_FILE);
  }
  const file = parsed as Partial<ExportFile> | null;
  if (typeof file !== 'object' || file === null || file.kind !== EXPORT_FILE_KIND || !Array.isArray(file.schedules)) {
    throw new Error(NOT_AN_EXPORT_FILE);
  }
  if (file.version !== EXPORT_FILE_VERSION) {
    throw new Error(`That Export file is format ${String(file.version)}; this page reads format ${EXPORT_FILE_VERSION}.`);
  }
  const slack = (typeof file.slack === 'object' && file.slack) || { relayUrl: '', sendKey: '', channel: '' };
  return { ...(file as ExportFile), slack };
}
