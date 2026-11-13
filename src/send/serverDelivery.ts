import { API_BASE, ApiError, apiRequest, browserFetch, type Fetch } from '../storage/apiStore';
import { clipboardDelivery } from './clipboardDelivery';
import { DeliveryFailure, type CrewDelivery } from './index';

/**
 * Send through the server: the picture goes to the Daily Schedule's server
 * (the API's Send, worker/src/send.ts), which posts it to the crew's Slack
 * channel. The same on every computer and phone, with nothing set up on any
 * of them. Nothing is left for the Scheduler to do.
 */
export function serverDelivery(fetchFn: Fetch = browserFetch, base: string = API_BASE): CrewDelivery {
  return {
    async deliver(picture, title) {
      try {
        await apiRequest(fetchFn, `${base}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'image/png', 'X-Title': encodeURIComponent(title) },
          body: picture,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status !== 0) {
          // The server's own words (the Slack relay's, when it gave any).
          throw new DeliveryFailure(`Nothing was sent. ${error.message} Then press "Send to crew" again.`);
        }
        throw new DeliveryFailure(
          'The Daily Schedule\'s server could not be reached, so nothing was sent. Check the internet connection and press "Send to crew" again.',
        );
      }
    },
    nextStep: '',
    failureMessage: 'The picture could not be sent to Slack. Press "Send to crew" to try again.',
  };
}

/**
 * How the picture reaches the crew from this page: through the server, and
 * copied for pasting only when the server says Slack is not connected there.
 * Never rejects: if the server could not say, it is the server delivery, so
 * that a Send says what is wrong in plain words. A failed check never stops
 * the board opening, and never quietly copies.
 */
export async function crewDelivery(fetchFn: Fetch = browserFetch, base: string = API_BASE): Promise<CrewDelivery> {
  try {
    const slack = (await (await apiRequest(fetchFn, `${base}/slack`)).json()) as { connected?: unknown } | null;
    if (slack?.connected === false) return clipboardDelivery();
  } catch (error) {
    console.error('Could not check whether Slack is connected', error);
  }
  return serverDelivery(fetchFn, base);
}
