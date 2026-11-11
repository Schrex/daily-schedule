import type { ReactNode } from 'react';
import type { SendState, SendStatus } from './useSend';
import './send.css';

/** The time of a Send as the Scheduler reads a clock: "6:42 PM". */
const clockTime = (sentAt: string): string =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(sentAt));

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
 * What happened to the last Send, in plain words, as a strip across the foot
 * of the header. Nothing until the Scheduler has pressed "Send to crew".
 */
export function SendMessage({ send }: { send: SendState }) {
  return (
    <div className="send-message" role="status" aria-live="polite">
      {message(send.status)}
    </div>
  );
}

function message(status: SendStatus): ReactNode {
  switch (status.kind) {
    case 'not-sent':
    case 'sending':
      return null;
    case 'refused': {
      // The names are not repeated here: they are ringed in red in the Not Placed list.
      const count = status.notPlaced.length;
      return (
        <div className="send-refused">
          <p className="send-headline">
            Not sent. {count === 1 ? '1 person is' : `${count} people are`} not placed yet.
          </p>
          <p>
            Give everyone under "Not placed yet" a place (Off Work counts). Then press "Send to crew"
            again.
          </p>
        </div>
      );
    }
    case 'failed':
      return (
        <div className="send-failed">
          <p className="send-headline">Not sent.</p>
          <p>{status.message}</p>
        </div>
      );
    case 'sent':
      return (
        <div className="send-sent">
          <p className="send-headline">Sent at {clockTime(status.sentAt)}</p>
          {status.nextStep && <p>{status.nextStep}</p>}
        </div>
      );
  }
}
