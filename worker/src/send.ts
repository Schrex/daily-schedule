import type { Env } from './app';
import type { D1Database } from './d1';
import { refuse } from './refuse';

/**
 * Send: the picture of the Daily Schedule goes from the page to this Worker,
 * which posts it to the crew's Slack channel through the Slack relay
 * (relay.ts, a separate Worker) with the send key.
 *
 * The relay's address (SLACK_RELAY_URL) and the send key (SLACK_SEND_KEY, a
 * secret) are this Worker's configuration. Neither is ever in an answer or in
 * the database: a page only learns whether Slack is connected.
 *
 * The Slack channel is kept in the database (the settings row), one for every
 * Editor and every device, and changed in Settings. Empty means the relay's
 * own channel.
 */

/** The biggest picture accepted, as the relay's. The 4K picture is a few MB at most. */
const MAX_BYTES = 20 * 1024 * 1024;

/** Slack is connected once the relay's https address and the send key are both set. */
export function slackIsConnected(env: Env): boolean {
  return relayAddress(env) !== null && sendKey(env) !== '';
}

/**
 * What was typed as the Slack channel, tidied (no stray spaces, in capitals):
 * a channel ID like C0CHSMJFFPS, or '' for the relay's own channel. Null when
 * it does not look like a channel ID.
 */
export function slackChannelFrom(typed: unknown): string | null {
  if (typeof typed !== 'string') return null;
  const channel = typed.trim().toUpperCase();
  return channel === '' || /^[CG][A-Z0-9]{6,}$/.test(channel) ? channel : null;
}

/** The saved Slack channel ID, or '' when none is set (the relay's own channel). */
export async function slackChannel(db: D1Database): Promise<string> {
  const row = await db.prepare('SELECT slack_channel FROM settings WHERE id = 1').first<{ slack_channel: string }>();
  return row?.slack_channel ?? '';
}

/** Keeps `channel` as the Slack channel for everyone, with who changed it and when. */
export async function saveSlackChannel(db: D1Database, channel: string, email: string): Promise<void> {
  await db
    .prepare(
      'INSERT INTO settings (id, slack_channel, saved_at, saved_by) VALUES (1, ?, ?, ?) ' +
        'ON CONFLICT (id) DO UPDATE SET slack_channel = excluded.slack_channel, saved_at = excluded.saved_at, saved_by = excluded.saved_by',
    )
    .bind(channel, new Date().toISOString(), email)
    .run();
}

/**
 * Posts the request's body (the picture, a PNG) to the Slack relay, titled
 * with its X-Title header (URI-encoded, as the relay takes it). 204 once Slack
 * has it; otherwise `{ error }` in plain words, the relay's own when it gave any.
 */
export async function sendToCrew(request: Request, env: Env, fetchImpl: typeof fetch): Promise<Response> {
  const relay = relayAddress(env);
  if (relay === null || sendKey(env) === '') {
    return refuse(503, 'Slack is not connected on the Daily Schedule\'s server yet, so nothing was sent.');
  }

  const tooBig = () => refuse(400, 'The picture is too large to send.');
  // A picture that says it is too big is refused before any of it is read.
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BYTES) return tooBig();
  // One that does not say (or says less than it is) is read only as far as the limit.
  const picture = await bodyUpTo(request, MAX_BYTES);
  if (picture === null) return tooBig();
  if (picture.byteLength === 0) return refuse(400, 'No picture was sent.');

  const title = request.headers.get('X-Title');
  // The channel saved in Settings; with none saved none is named, and the relay posts to its own.
  const channel = await slackChannel(env.DB);
  let response: Response;
  try {
    response = await fetchImpl(`${relay}/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sendKey(env)}`,
        'Content-Type': 'image/png',
        ...(title ? { 'X-Title': title } : {}),
        ...(channel ? { 'X-Channel': channel } : {}),
      },
      body: picture,
    });
  } catch (error) {
    console.error('Could not reach the Slack relay', error);
    return refuse(502, 'The Slack relay could not be reached.');
  }

  const answer = (await response.json().catch(() => null)) as { ok?: unknown; error?: unknown } | null;
  if (response.ok && answer?.ok === true) return new Response(null, { status: 204 });
  if (response.status === 401) {
    // The relay's own words point at the old per-browser field; the key is the server's now.
    return refuse(
      502,
      'The Daily Schedule\'s send key does not match the Slack relay\'s. Whoever looks after the app has to set it again.',
    );
  }
  return refuse(
    502,
    typeof answer?.error === 'string' && answer.error ? answer.error : 'The Slack relay did not answer properly.',
  );
}

/**
 * The request's body, read a piece at a time and never further than `limit`
 * bytes: null as soon as it is bigger, with the rest left unread.
 */
async function bodyUpTo(request: Request, limit: number): Promise<Uint8Array<ArrayBuffer> | null> {
  if (request.body === null) return new Uint8Array(0);
  const reader = request.body.getReader();
  const pieces: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    pieces.push(value);
  }
  const whole = new Uint8Array(size);
  let at = 0;
  for (const piece of pieces) {
    whole.set(piece, at);
    at += piece.byteLength;
  }
  return whole;
}

/** The relay's address without a trailing slash, or null when it is not set or not https. */
function relayAddress(env: Env): string | null {
  const address = (env.SLACK_RELAY_URL ?? '').trim().replace(/\/+$/, '');
  return /^https:\/\/\S+$/.test(address) ? address : null;
}

const sendKey = (env: Env): string => (env.SLACK_SEND_KEY ?? '').trim();
