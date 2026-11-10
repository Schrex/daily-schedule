import type { CrewDelivery } from './index';

/**
 * The first delivery: the picture goes on the clipboard and the Scheduler
 * pastes it into Slack himself.
 */
export function clipboardDelivery(): CrewDelivery {
  return {
    async deliver(picture) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': picture })]);
    },
    nextStep: 'The picture is copied. Now go to Slack, click where you type, and press Ctrl + V to paste it.',
    failureMessage:
      'The picture could not be copied, so nothing was sent. Press "Send to crew" to try again.',
  };
}
