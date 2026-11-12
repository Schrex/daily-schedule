/**
 * The Slack relay: takes the picture of the Daily Schedule from the
 * Scheduler's screen and posts it to a Slack channel as a file, at full size.
 *
 * It exists because the Slack bot token must stay secret (it lives here, as a
 * Cloudflare secret, never in the browser) and because Slack's file upload
 * cannot be called from a web page. The screen proves it may send by giving
 * the send key, a second secret shared only with the Scheduler's computer.
 *
 * One request: POST /send with the PNG as the body and
 *   Authorization: Bearer <send key>
 *   X-Title:       the message posted with the picture, URI-encoded (optional)
 *   X-Channel:     a Slack channel ID to post to instead of SLACK_CHANNEL (optional)
 * It answers { ok: true } once Slack has the picture, or { ok: false, error }
 * where `error` is in plain words for the Scheduler.
 */

export interface Env {
  /** The Slack app's Bot User OAuth Token (xoxb-…). A secret. */
  SLACK_BOT_TOKEN: string;
  /** What the Scheduler's screen must present to send. A secret. */
  SEND_KEY: string;
  /** The channel ID posted to when the screen names none. */
  SLACK_CHANNEL?: string;
  /** The address of the Scheduler's screen, for the browser; "*" if unset. */
  ALLOWED_ORIGIN?: string;
}

/** The biggest picture accepted. The 4K picture is a few MB at most. */
const MAX_BYTES = 20 * 1024 * 1024;
const CHANNEL_ID = /^[CGD][A-Z0-9]{6,}$/;
/** The grey line Slack shows over the picture. */
export const PICTURE_CAPTION = 'Tap to see it full size';

export async function handle(request: Request, env: Env, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const cors = {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Title, X-Channel',
    'Access-Control-Max-Age': '86400',
  };
  const answer = (status: number, body: { ok: boolean; error?: string }) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  const refuse = (status: number, error: string) => answer(status, { ok: false, error });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (new URL(request.url).pathname !== '/send') return refuse(404, 'Nothing here.');
  if (request.method !== 'POST') return refuse(405, 'Use POST.');

  if (!env.SLACK_BOT_TOKEN || !env.SEND_KEY) {
    return refuse(500, 'The Slack relay is not set up yet: its Slack token or send key is missing.');
  }
  const given = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!sameSecret(given, env.SEND_KEY)) {
    return refuse(401, 'The send key in Settings does not match the Slack relay. Check it in Settings.');
  }

  const channel = (request.headers.get('X-Channel') ?? '').trim() || (env.SLACK_CHANNEL ?? '').trim();
  if (!CHANNEL_ID.test(channel)) {
    return refuse(400, 'No Slack channel is chosen, or the channel ID is not right. Check it in Settings.');
  }

  const picture = new Uint8Array(await request.arrayBuffer());
  if (picture.length === 0) return refuse(400, 'No picture was sent.');
  if (picture.length > MAX_BYTES) return refuse(413, 'The picture is too large to send.');

  const title = decodeTitle(request.headers.get('X-Title')) || 'Daily Schedule';
  const filename = `${title.replace(/[^A-Za-z0-9 ,-]+/g, '').trim().replace(/\s+/g, '-') || 'Daily-Schedule'}.png`;

  try {
    await postToSlack(fetchImpl, env.SLACK_BOT_TOKEN, { channel, title, filename, picture });
  } catch (error) {
    return refuse(502, error instanceof SlackError ? error.plain : 'Slack could not be reached.');
  }
  return answer(200, { ok: true });
}

/** Slack's three-step upload: ask where to put it, put it there, then share it in the channel. */
async function postToSlack(
  fetchImpl: typeof fetch,
  token: string,
  file: { channel: string; title: string; filename: string; picture: Uint8Array<ArrayBuffer> },
): Promise<void> {
  const auth = { Authorization: `Bearer ${token}` };

  const where = await slackCall(fetchImpl, auth, 'files.getUploadURLExternal', {
    filename: file.filename,
    length: String(file.picture.length),
  });
  const uploadUrl = String(where.upload_url ?? '');
  const fileId = String(where.file_id ?? '');
  if (!uploadUrl || !fileId) throw new SlackError('no_upload_url');

  const put = await fetchImpl(uploadUrl, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/octet-stream' },
    body: file.picture,
  });
  if (!put.ok) throw new SlackError(`upload_failed_${put.status}`);

  // The title is the message itself; the picture's own caption (the grey line
  // over it in Slack) says what to do with it rather than repeating the title.
  await slackCall(fetchImpl, auth, 'files.completeUploadExternal', {
    files: JSON.stringify([{ id: fileId, title: PICTURE_CAPTION }]),
    channel_id: file.channel,
    initial_comment: file.title,
  });
}

async function slackCall(
  fetchImpl: typeof fetch,
  auth: Record<string, string>,
  method: string,
  fields: Record<string, string>,
): Promise<Record<string, unknown>> {
  const response = await fetchImpl(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.ok !== true) throw new SlackError(String(body.error ?? `http_${response.status}`));
  return body;
}

/** A refusal from Slack, with what to tell the Scheduler. */
export class SlackError extends Error {
  readonly plain: string;
  constructor(readonly code: string) {
    super(`Slack: ${code}`);
    this.plain = plainSlackError(code);
  }
}

function plainSlackError(code: string): string {
  switch (code) {
    case 'not_in_channel':
    case 'channel_not_found':
      return 'The Daily Schedule bot is not in that Slack channel. In Slack, open the channel and type /invite @Daily Schedule.';
    case 'invalid_auth':
    case 'not_authed':
    case 'token_revoked':
    case 'token_expired':
    case 'account_inactive':
      return 'Slack did not accept the relay\'s token. The Slack app may need installing again.';
    case 'missing_scope':
      return 'The Slack app is missing the files:write permission. Add it and reinstall the app.';
    case 'ratelimited':
      return 'Slack is busy. Wait a minute.';
    default:
      return `Slack refused the picture (${code}).`;
  }
}

function decodeTitle(raw: string | null): string {
  if (!raw) return '';
  try {
    return decodeURIComponent(raw).slice(0, 200).trim();
  } catch {
    return '';
  }
}

/** Compares two secrets without stopping at the first difference. */
function sameSecret(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < given.length; index += 1) {
    difference |= given.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}
