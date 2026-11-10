import type { SendState } from './useSend';
import './send.css';

/** The time of a Send as the Scheduler reads a clock: "6:42 PM". */
const clockTime = (sentAt: string): string =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(sentAt));

/**
 * The bar that finishes the evening: one large "Send to crew" button and, in
 * plain words, what happened. Stateless: it draws the `SendState` it is given.
 */
export function SendBar({ send }: { send: SendState }) {
  const { refused, failure, justSent, sentAt } = send;
  const sentTime = sentAt === undefined ? null : clockTime(sentAt);

  return (
    <section className="send-bar" aria-label="Send to crew">
      <button type="button" className="send-button" disabled={send.sending} onClick={send.send}>
        Send to crew
      </button>

      <div className="send-message" role="status" aria-live="polite">
        {refused ? (
          <div className="send-refused">
            <p className="send-headline">
              Not sent. {refused.length === 1 ? '1 person is' : `${refused.length} people are`} not
              placed yet:
            </p>
            <ul className="names send-refused-names">
              {refused.map((crewMember) => (
                <li key={crewMember.id}>
                  <span className={`name send-refused-name color-${crewMember.color}`}>
                    {crewMember.name}
                  </span>
                </li>
              ))}
            </ul>
            <p>Give everyone a place (Off Work counts). Then press "Send to crew" again.</p>
          </div>
        ) : failure ? (
          <div className="send-failed">
            <p className="send-headline">Not sent.</p>
            <p>{failure}</p>
          </div>
        ) : send.sending ? (
          <p>Sending…</p>
        ) : justSent ? (
          <div className="send-sent">
            <p className="send-headline">Sent at {sentTime}</p>
            {justSent.nextStep && <p>{justSent.nextStep}</p>}
          </div>
        ) : sentTime ? (
          <div className="send-sent">
            <p className="send-headline">Sent at {sentTime}</p>
            <p>If you change something, press "Send to crew" again.</p>
          </div>
        ) : (
          <p>When the schedule is finished, press "Send to crew".</p>
        )}
      </div>
    </section>
  );
}
