import { EXPORT_FILE_KIND, EXPORT_FILE_VERSION, NOT_AN_EXPORT_FILE } from '../../shared';
import type { D1Database } from './d1';
import { refuse } from './refuse';
import { saveRoster } from './roster';
import { isDailySchedule, isRecord, isRoster } from './shapes';

/**
 * `POST /api/import`: replaces the Roster and every Daily Schedule with those
 * in an Export file (src/exportFile), for an editor moving their data from the
 * old address. The starter Roster and Daily Schedule made on first open go
 * with everything else.
 *
 * Refused with 409 once any saved Daily Schedule has a Send recorded, so an
 * old file can never overwrite real work. Answers `{ schedules }`, the number
 * of Daily Schedules saved.
 */
export async function handleImport(request: Request, db: D1Database, email: string): Promise<Response> {
  let file: unknown;
  try {
    file = await request.json();
  } catch {
    return refuse(400, NOT_AN_EXPORT_FILE);
  }
  if (!isRecord(file) || file.kind !== EXPORT_FILE_KIND || !Array.isArray(file.schedules)) {
    return refuse(400, NOT_AN_EXPORT_FILE);
  }
  if (file.version !== EXPORT_FILE_VERSION) {
    return refuse(400, `Export file format ${String(file.version)} is not one this server reads.`);
  }
  if (!isRoster(file.roster)) return refuse(400, 'The Export file has no Roster.');
  const schedules = file.schedules;
  if (!schedules.every(isDailySchedule)) return refuse(400, 'The Export file holds something that is not a Daily Schedule.');
  if (new Set(schedules.map((schedule) => schedule.date)).size !== schedules.length) {
    return refuse(400, 'The Export file has two Daily Schedules for the same date.');
  }

  const sent = await db
    .prepare("SELECT date FROM schedules WHERE json_array_length(body, '$.sends') > 0 LIMIT 1")
    .first<{ date: string }>();
  if (sent !== null) {
    return refuse(
      409,
      `The Daily Schedule for ${sent.date} has already been Sent from here, so an Export file can no longer replace the saved schedules.`,
    );
  }

  const now = new Date().toISOString();
  // One batch: all of it is saved, or none of it.
  await db.batch([
    db.prepare('DELETE FROM schedules'),
    saveRoster(db, file.roster, now, email),
    ...schedules.map((schedule) =>
      db
        .prepare('INSERT INTO schedules (date, body, saved_at, saved_by) VALUES (?, ?, ?, ?)')
        .bind(schedule.date, JSON.stringify(schedule), now, email),
    ),
  ]);
  return Response.json({ schedules: schedules.length });
}
