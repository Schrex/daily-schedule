import type { Env } from './app';
import type { D1Database } from './d1';
import { whoIsCalling } from './signIn';

/**
 * The API under /daily-schedule/api/. It mirrors the pages' `ScheduleStore`
 * (src/storage): the bodies are the Roster and Daily Schedule JSON as the
 * pages hold them, kept whole in D1 (migrations/).
 *
 *   GET /me                 { email, role }                anyone on the list
 *   GET /roster             the Roster, or null           editors and viewers
 *   PUT /roster             saves the Roster              editors
 *   GET /schedules          the saved dates, earliest first
 *   GET /schedules/:date    that Daily Schedule, or null
 *   PUT /schedules/:date    saves it (its date must be :date)  editors
 *
 * 401: nobody signed in. 403: not on the access list, or a viewer writing.
 * 400: a malformed body or date. Errors are `{ error }` in plain words.
 */
export async function handleApi(request: Request, env: Env, path: string): Promise<Response> {
  const email = await whoIsCalling(request, env);
  if (email === null) return refuse(401, 'You are not signed in.');
  const role = await roleOf(env.DB, email);
  if (role === null) return refuse(403, 'You don\'t have access to the Daily Schedule. Ask the Scheduler.');

  const reading = request.method === 'GET';
  const writing = request.method === 'PUT';
  if (!reading && !writing) return refuse(405, 'That method is not allowed here.');
  if (writing && role !== 'editor') return refuse(403, 'Only an editor can change the Daily Schedule.');

  if (path === 'me' && reading) return Response.json({ email, role });

  if (path === 'roster') {
    if (reading) return Response.json(await readBody(env.DB.prepare('SELECT body FROM roster WHERE id = 1')));
    const roster = await bodyOf(request);
    if (!isRoster(roster)) return refuse(400, 'That is not a Roster.');
    await env.DB.prepare(
      'INSERT INTO roster (id, body, saved_at, saved_by) VALUES (1, ?, ?, ?) ' +
        'ON CONFLICT (id) DO UPDATE SET body = excluded.body, saved_at = excluded.saved_at, saved_by = excluded.saved_by',
    )
      .bind(JSON.stringify(roster), new Date().toISOString(), email)
      .run();
    return new Response(null, { status: 204 });
  }

  if (path === 'schedules' && reading) {
    const { results } = await env.DB.prepare('SELECT date FROM schedules ORDER BY date').all<{ date: string }>();
    return Response.json(results.map((row) => row.date));
  }

  const date = /^schedules\/(.+)$/.exec(path)?.[1];
  if (date !== undefined) {
    if (!isDate(date)) return refuse(400, 'That is not a date (YYYY-MM-DD).');
    if (reading) {
      return Response.json(await readBody(env.DB.prepare('SELECT body FROM schedules WHERE date = ?').bind(date)));
    }
    const schedule = await bodyOf(request);
    if (!isDailySchedule(schedule)) return refuse(400, 'That is not a Daily Schedule.');
    if (schedule.date !== date) return refuse(400, `That Daily Schedule is for ${schedule.date}, not ${date}.`);
    await env.DB.prepare(
      'INSERT INTO schedules (date, body, saved_at, saved_by) VALUES (?, ?, ?, ?) ' +
        'ON CONFLICT (date) DO UPDATE SET body = excluded.body, saved_at = excluded.saved_at, saved_by = excluded.saved_by',
    )
      .bind(date, JSON.stringify(schedule), new Date().toISOString(), email)
      .run();
    return new Response(null, { status: 204 });
  }

  return refuse(404, 'Not found.');
}

type Role = 'editor' | 'viewer';

async function roleOf(db: D1Database, email: string): Promise<Role | null> {
  // Emails are compared without regard to case, as sign-in providers do.
  const row = await db
    .prepare('SELECT role FROM people WHERE lower(email) = lower(?)')
    .bind(email)
    .first<{ role: Role }>();
  return row?.role ?? null;
}

/** An error answer: `{ error }` in plain words. */
const refuse = (status: number, error: string) => Response.json({ error }, { status });

/** The stored JSON of the row found, or null. */
async function readBody(statement: ReturnType<D1Database['prepare']>): Promise<unknown> {
  const row = await statement.first<{ body: string }>();
  return row === null ? null : JSON.parse(row.body);
}

/** The request's JSON body, or undefined if it isn't JSON. */
async function bodyOf(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** The Roster's shape, checked only as far as keeping it safely needs. */
const isRoster = (value: unknown): boolean =>
  isRecord(value) && Array.isArray(value.crewMembers) && Array.isArray(value.jobs);

const isDailySchedule = (value: unknown): value is { date: string } =>
  isRecord(value) &&
  isDate(value.date) &&
  Array.isArray(value.placements) &&
  isRecord(value.tasks) &&
  Array.isArray(value.sends);
