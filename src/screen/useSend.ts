import { useRef, useState } from 'react';
import {
  crewView,
  lastSentAt,
  sendCheck,
  type CrewMember,
  type CrewView,
  type DailySchedule,
  type Roster,
} from '../schedule-rules';
import type { CrewDelivery } from '../send';
import { renderCrewPicture } from '../send/crewPicture';

/** Where Send stands for the Daily Schedule on the screen: exactly one of these. */
export type SendStatus =
  /** Never sent, and nothing to report. */
  | { kind: 'not-sent' }
  /** The picture is being drawn and delivered. */
  | { kind: 'sending' }
  /** Send was refused for this Daily Schedule: the Crew Members who are Not Placed. */
  | { kind: 'refused'; notPlaced: CrewMember[] }
  /** The last Send could not be delivered: what to tell the Scheduler. */
  | { kind: 'failed'; message: string }
  /** It has been sent: when (from its send record), and what he does next. */
  | { kind: 'sent'; sentAt: string; nextStep: string };

/** What the Send bar draws, and what its button does. */
export interface SendState {
  status: SendStatus;
  /** "Send to crew" was pressed. */
  send: () => void;
}

/** What the last press of "Send to crew" came to, and the Daily Schedule it was about. */
interface Outcome {
  kind: 'refused' | 'failed' | 'sent';
  schedule: DailySchedule;
}

/**
 * Send, start to finish: ask the schedule rules whether Send is allowed, draw
 * the crew view as a picture, hand it to the delivery, and only when that
 * worked report the crew view that was delivered through `onDelivered`, for
 * the send record.
 *
 * What a press came to is remembered only for the Daily Schedule it was
 * about: as soon as the schedule changes, the refusal or the "paste it"
 * instruction goes away. The "Sent" time itself comes from the send record,
 * so it is still there after a reload.
 */
export function useSend({
  roster,
  schedule,
  delivery,
  onDelivered,
}: {
  roster: Roster;
  schedule: DailySchedule;
  delivery: CrewDelivery;
  /**
   * The delivery worked: the crew view the crew got, and when. Records the
   * Send on the Daily Schedule as it stands by then, and returns the result.
   */
  onDelivered: (sent: CrewView, sentAt: string) => DailySchedule;
}): SendState {
  const [sending, setSending] = useState(false);
  /** True from press to delivery, so a second press in between does nothing. */
  const inFlight = useRef(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const check = sendCheck(roster, schedule);

  const send = async () => {
    if (inFlight.current) return;
    if (!check.allowed) {
      setOutcome({ kind: 'refused', schedule });
      return;
    }

    const view = crewView(roster, schedule);
    inFlight.current = true;
    setSending(true);
    try {
      await delivery.deliver(await renderCrewPicture(view));
    } catch (error) {
      console.error('Could not send the Daily Schedule', error);
      setOutcome({ kind: 'failed', schedule });
      return;
    } finally {
      inFlight.current = false;
      setSending(false);
    }

    setOutcome({ kind: 'sent', schedule: onDelivered(view, new Date().toISOString()) });
  };

  const pressed = outcome?.schedule === schedule ? outcome.kind : null;
  const sentAt = lastSentAt(schedule);

  const status: SendStatus =
    pressed === 'refused'
      ? { kind: 'refused', notPlaced: check.notPlaced }
      : pressed === 'failed'
        ? { kind: 'failed', message: delivery.failureMessage }
        : sending
          ? { kind: 'sending' }
          : sentAt === undefined
            ? { kind: 'not-sent' }
            : {
                kind: 'sent',
                sentAt,
                nextStep:
                  pressed === 'sent'
                    ? delivery.nextStep
                    : 'If you change something, press "Send to crew" again.',
              };

  return { status, send: () => void send() };
}
