import type { ReactNode } from 'react';
import type { SendState, SendStatus } from './useSend';
import './send.css';

/** The time of a Send as the Scheduler reads a clock: "6:42 PM". */
const clockTime = (sentAt: string): string =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(sentAt));

/**
 * The bar that finishes the evening: one large "Send to crew" button and, in
 * plain words, what happened. Stateless: it draws the `SendState` it is given.
 */
export function SendBar({ send }: { send: SendState }) {
  return (
    <section className="send-bar" aria-label="Send to crew">
      <button
        type="button"
        className="button button-primary send-button"
        disabled={send.status.kind === 'sending'}
        onClick={send.send}
      >
        Send to crew
      </button>

      <div className="send-message" role="status" aria-live="polite">
        {message(send.status)}
      </div>
    </section>
  );
}

function message(status: SendStatus): ReactNode {
  switch (status.kind) {
    case 'not-sent':
      return <p>When the schedule is finished, press "Send to crew".</p>;
    case 'sending':
      return <p>Sending…</p>;
    case 'refused': {
      // The names are not repeated here: they are ringed in red in the Not Placed list.
      const count = status.notPlaced.length;
      return (
        <div className="send-refused">
          <p className="send-headline">
            Not sent. {count === 1 ? '1 person is' : `${count} people are`} not placed yet.
          </p>
          <p>
            Give everyone under NOT PLACED a place (Off Work counts). Then press "Send to crew"
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
