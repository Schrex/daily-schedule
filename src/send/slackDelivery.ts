import { DeliveryFailure, type CrewDelivery } from './index';
import { cleanSlackSettings, type SlackSettings } from './slackSettings';

/**
 * Send straight to Slack: the picture goes to the Slack relay (worker/), which
 * posts it to the chosen channel as a full-size file. Nothing is left for the
 * Scheduler to do.
 */
export function slackDelivery(settings: SlackSettings, fetchImpl: typeof fetch = fetch): CrewDelivery {
  const { relayUrl, sendKey, channel } = cleanSlackSettings(settings);

  return {
    async deliver(picture, title) {
      let response: Response;
      try {
        response = await fetchImpl(`${relayUrl}/send`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sendKey}`,
            'Content-Type': 'image/png',
            'X-Title': encodeURIComponent(title),
            ...(channel ? { 'X-Channel': channel } : {}),
          },
          body: picture,
        });
      } catch {
        throw new DeliveryFailure(
          'Slack could not be reached, so nothing was sent. Check the internet connection and press "Send to crew" again.',
        );
      }
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || body?.ok !== true) {
        throw new DeliveryFailure(
          `Nothing was sent. ${body?.error ?? 'The Slack relay did not answer properly.'} Then press "Send to crew" again.`,
        );
      }
    },
    nextStep: '',
    failureMessage: 'The picture could not be sent to Slack. Press "Send to crew" to try again.',
  };
}
