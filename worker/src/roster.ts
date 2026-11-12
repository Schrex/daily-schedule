import type { D1Database, D1PreparedStatement } from './d1';

/**
 * Saves the Roster (there is one, row 1), replacing any saved one, with who
 * saved it and when. A statement, so that it can run alone (PUT /roster) or
 * in a batch with the Daily Schedules (POST /import).
 */
export const saveRoster = (db: D1Database, roster: unknown, savedAt: string, savedBy: string): D1PreparedStatement =>
  db
    .prepare(
      'INSERT INTO roster (id, body, saved_at, saved_by) VALUES (1, ?, ?, ?) ' +
        'ON CONFLICT (id) DO UPDATE SET body = excluded.body, saved_at = excluded.saved_at, saved_by = excluded.saved_by',
    )
    .bind(JSON.stringify(roster), savedAt, savedBy);
