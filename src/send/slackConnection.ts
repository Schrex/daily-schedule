import { API_BASE, apiRequest, browserFetch, type Fetch } from '../storage/apiStore';

/**
 * Slack, as the Daily Schedule's server has it (the API's /slack,
 * worker/src/send.ts): whether Send reaches Slack, and the channel the
 * picture goes to. Both are the same for every Editor and every device;
 * nothing about Slack is kept in a browser.
 */
export interface SlackConnection {
  /** Whether the server can post to Slack (its relay address and send key are set). */
  connected: boolean;
  /** The Slack channel ID (C0…). Empty: the relay's own channel. */
  channel: string;
}

/** Asks the server. Rejects (an ApiError) if it could not say. */
export async function loadSlackConnection(
  fetchFn: Fetch = browserFetch,
  base: string = API_BASE,
): Promise<SlackConnection> {
  const answer = (await (await apiRequest(fetchFn, `${base}/slack`)).json()) as Partial<SlackConnection>;
  return {
    connected: answer.connected === true,
    channel: typeof answer.channel === 'string' ? answer.channel : '',
  };
}

/**
 * Changes the channel for everyone (an Editor only). Rejects (an ApiError)
 * with the server's own words when it is refused, as for a channel that does
 * not look like one.
 */
export async function changeSlackChannel(
  channel: string,
  fetchFn: Fetch = browserFetch,
  base: string = API_BASE,
): Promise<void> {
  await apiRequest(fetchFn, `${base}/slack`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel }),
  });
}
