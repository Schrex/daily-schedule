import type { Role } from '../../shared';
import { crewPageShown, type DailySchedule, type Roster } from '../../src/schedule-rules';
import type { Env } from './app';
import type { D1Database } from './d1';
import { refuse } from './refuse';
import { saveSlackChannel, sendToCrew, slackChannel, slackChannelFrom, slackIsConnected } from './send';
import { isDailySchedule, isDate, isRecord, isRoster } from './shapes';
import { whoIsCalling } from './signIn';

/**
 * The API under /daily-schedule/api/. It mirrors the pages' `ScheduleStore`
 * (src/storage): the bodies are the Roster and Daily Schedule JSON as the
 * pages hold them, kept whole in D1 (migrations/).
 *
 *   GET /me                 { email, role }                anyone signed in
 *   GET /roster             the Roster, or null           editors and viewers
 *   PUT /roster             saves the Roster              editors
 *   GET /schedules          the saved dates, earliest first       editors
 *   GET /schedules/:date    that Daily Schedule, or null          editors
 *   PUT /schedules/:date    saves it (its date must be :date)  editors
 *   GET /crew-page          { jobs, sent, previous }: what the Crew Page and the
 *                           Office TV show, and nothing that has not been Sent
 *                           (`crewPageShown`)             editors and viewers
 *   GET /slack              { connected, channel }: whether Send reaches Slack,
 *                           and the Slack channel ID it posts to ('' is the
 *                           relay's own channel)          editors and viewers
 *   PUT /slack              { channel }: changes the channel for everyone  editors
 *   POST /send              posts the picture (the body, a PNG; its title
 *                           URI-encoded in X-Title) to Slack (send.ts)  editors
 *
 * Editors are the people listed as `editor`; everyone else signed in to the
 * hub is a viewer, sent to the Crew Page by the pages.
 *
 * A viewer is never given a saved Daily Schedule, only what has been Sent
 * (/crew-page): the board as it stands is the Editors' alone.
 *
 * 401: nobody signed in. 403: a viewer writing, sending or reading the saved Daily Schedules.
 * 400: a malformed body or date, or a picture that is missing or too big.
 * Errors are `{ error }` in plain words.
 */
export async function handleApi(
  request: Request,
  env: Env,
  path: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const email = await whoIsCalling(request, env);
  if (email === null) return refuse(401, 'You are not signed in.');
  const role = await roleOf(env.DB, email);

  const reading = request.method === 'GET';
  const writing = request.method === 'PUT';
  const sending = request.method === 'POST' && path === 'send';
  if (!reading && !writing && !sending) return refuse(405, 'That method is not allowed here.');
  if (writing && role !== 'editor') return refuse(403, 'Only an Editor can change the Daily Schedule.');
  if (sending && role !== 'editor') return refuse(403, 'Only an Editor can send the Daily Schedule to the crew.');

  if (path === 'me' && reading) return Response.json({ email, role });

  if (path === 'slack') {
    // Only whether it is connected and the channel: the relay's address and the send key stay here.
    if (reading) {
      return Response.json({ connected: slackIsConnected(env), channel: await slackChannel(env.DB) });
    }
    const change = await bodyOf(request);
    const channel = isRecord(change) ? slackChannelFrom(change.channel) : null;
    if (channel === null) {
      return refuse(
        400,
        'A channel ID looks like C0CHSMJFFPS (in Slack: the channel name, then the foot of About). Leave it empty to use the relay\'s own channel.',
      );
    }
    await saveSlackChannel(env.DB, channel, email);
    return new Response(null, { status: 204 });
  }
  if (sending) return sendToCrew(request, env, fetchImpl);

  if (path === 'crew-page' && reading) {
    const roster = (await readBody(env.DB.prepare('SELECT body FROM roster WHERE id = 1'))) as Roster | null;
    // Only the two latest dates that have been Sent are read: the rules need no more, and nothing else leaves here.
    const { results } = await env.DB.prepare(
      "SELECT body FROM schedules WHERE json_array_length(body, '$.sends') > 0 ORDER BY date DESC LIMIT 2",
    ).all<{ body: string }>();
    const sent = results.map((row) => JSON.parse(row.body) as DailySchedule);
    return Response.json(crewPageShown(roster ?? { crewMembers: [], jobs: [] }, sent));
  }

  if (path === 'roster') {
    if (reading) return Response.json(await readBody(env.DB.prepare('SELECT body FROM roster WHERE id = 1')));
    const roster = await bodyOf(request);
    if (!isRoster(roster)) return refuse(400, 'That is not a Roster.');
    // There is one Roster (row 1); a save replaces it, with who saved it and when.
    await env.DB.prepare(
      'INSERT INTO roster (id, body, saved_at, saved_by) VALUES (1, ?, ?, ?) ' +
        'ON CONFLICT (id) DO UPDATE SET body = excluded.body, saved_at = excluded.saved_at, saved_by = excluded.saved_by',
    )
      .bind(JSON.stringify(roster), new Date().toISOString(), email)
      .run();
    return new Response(null, { status: 204 });
  }

  // The saved Daily Schedules are the board as it stands, Sent or not: Editors only.
  if ((path === 'schedules' || path.startsWith('schedules/')) && role !== 'editor') {
    return refuse(403, 'Only an Editor can open the board. The Crew Page shows what has been Sent.');
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

/** `editor` for the people listed as editors; everyone else signed in is a viewer. */
async function roleOf(db: D1Database, email: string): Promise<Role> {
  // Emails are compared without regard to case, as sign-in providers do.
  const row = await db
    .prepare('SELECT role FROM people WHERE lower(email) = lower(?)')
    .bind(email)
    .first<{ role: Role }>();
  return row?.role === 'editor' ? 'editor' : 'viewer';
}

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
