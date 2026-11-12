import { sentStamp } from '../schedule-rules';
import type { SendState } from './useSend';
import './send.css';

/**
 * "Send to crew": the one main action, at the right end of the header, the
 * same place every evening. Stateless: it draws the `SendState` it is given.
 */
export function SendButton({ send }: { send: SendState }) {
  return (
    <button
      type="button"
      className="button button-primary toolbar-button send-button"
      disabled={send.status.kind === 'sending'}
      onClick={send.send}
    >
      {send.status.kind === 'sending' ? 'Sending…' : 'Send to crew'}
    </button>
  );
}

/**
 * When the Daily Schedule was last Sent, as one quiet line under the date:
 * "Last sent Wed, Nov 11 · 6:42 PM", or "Not sent yet". Right after a Send
 * that left the Scheduler something to do (pasting the picture into Slack
 * when Slack is not set up), that step follows it, as quietly.
 */
export function LastSent({ send }: { send: SendState }) {
  const { status } = send;
  return (
    <p className="last-sent" role="status" aria-live="polite">
      {status.kind === 'sending'
        ? 'Sending…'
        : status.kind === 'sent'
          ? sentStamp(new Date(status.sentAt)).replace(/^Sent /, 'Last sent ')
          : status.kind === 'failed' && status.sentAt
            ? sentStamp(new Date(status.sentAt)).replace(/^Sent /, 'Last sent ')
            : 'Not sent yet'}
      {status.kind === 'sent' && status.nextStep && (
        <span className="last-sent-step" title="The picture is copied: in Slack, click where you type and press Ctrl + V">
          {' · '}
          {status.nextStep}
        </span>
      )}
    </p>
  );
}

/**
 * A Send that could not be delivered: a red strip across the foot of the
 * header, in plain words, so it cannot be missed. Nothing otherwise.
 */
export function SendFailure({ send }: { send: SendState }) {
  const { status } = send;
  return (
    <div className="send-message" role="alert">
      {status.kind === 'failed' && (
        <div className="send-failed">
          <p className="send-headline">Not sent.</p>
          <p>{status.message}</p>
        </div>
      )}
    </div>
  );
}
