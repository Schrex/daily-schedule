import type { Env } from './app';
import { refuse } from './refuse';

/**
 * Send: the picture of the Daily Schedule goes from the page to this Worker,
 * which posts it to the crew's Slack channel through the Slack relay
 * (relay.ts, a separate Worker) with the send key.
 *
 * The relay's address (SLACK_RELAY_URL) and the send key (SLACK_SEND_KEY, a
 * secret) are this Worker's configuration. Neither is ever in an answer or in
 * the database: a page only learns whether Slack is connected.
 */

/** The biggest picture accepted, as the relay's. The 4K picture is a few MB at most. */
const MAX_BYTES = 20 * 1024 * 1024;

/** Slack is connected once the relay's https address and the send key are both set. */
export function slackIsConnected(env: Env): boolean {
  return relayAddress(env) !== null && sendKey(env) !== '';
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
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BYTES) return tooBig();
  const picture = await request.arrayBuffer();
  if (picture.byteLength === 0) return refuse(400, 'No picture was sent.');
  if (picture.byteLength > MAX_BYTES) return tooBig();

  const title = request.headers.get('X-Title');
  let response: Response;
  try {
    // No channel is named, so the relay posts to its own channel.
    response = await fetchImpl(`${relay}/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sendKey(env)}`,
        'Content-Type': 'image/png',
        ...(title ? { 'X-Title': title } : {}),
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

/** The relay's address without a trailing slash, or null when it is not set or not https. */
function relayAddress(env: Env): string | null {
  const address = (env.SLACK_RELAY_URL ?? '').trim().replace(/\/+$/, '');
  return /^https:\/\/\S+$/.test(address) ? address : null;
}

const sendKey = (env: Env): string => (env.SLACK_SEND_KEY ?? '').trim();
