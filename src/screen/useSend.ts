import { useRef, useState } from 'react';
import {
  crewView,
  sendTitle,
  lastSentAt,
  type CrewView,
  type DailySchedule,
  type Roster,
} from '../schedule-rules';
import { DeliveryFailure, type CrewDelivery } from '../send';
import { renderCrewPicture } from '../send/crewPicture';

/** Where Send stands for the Daily Schedule on the screen: exactly one of these. */
export type SendStatus =
  /** Never sent, and nothing to report. */
  | { kind: 'not-sent' }
  /** The picture is being drawn and delivered. */
  | { kind: 'sending' }
  /** The last Send could not be delivered: what to tell the Scheduler (and when it was last Sent, if ever). */
  | { kind: 'failed'; message: string; sentAt?: string }
  /** It has been sent: when (from its send record), and what is left to do right after a Send (often nothing). */
  | { kind: 'sent'; sentAt: string; nextStep: string };

/** What the Send bar draws, and what its button does. */
export interface SendState {
  status: SendStatus;
  /** "Send to crew" was pressed. */
  send: () => void;
}

/** What the last press of "Send to crew" came to, and the Daily Schedule it was about. */
interface Outcome {
  kind: 'failed' | 'sent';
  schedule: DailySchedule;
  /** For a failure: what to tell the Scheduler, if the delivery said. */
  message?: string;
}

/**
 * Send, start to finish: wait until the board is ready (`ready`), draw the
 * crew view of the Daily Schedule as it stands then (`latest`) as a picture
 * (anyone Not Placed is left out of it), hand it to the delivery, and only
 * when that worked report the crew view that was delivered through
 * `onDelivered`, for the send record.
 *
 * What a press came to is remembered only for the Daily Schedule it was
 * about: as soon as the schedule changes, the failure or the "paste it"
 * instruction goes away. The "Sent" time itself comes from the send record,
 * so it is still there after a reload. Every delivered Send is recorded, a
 * re-Send of an unchanged picture too, so that time is always the one stamped
 * on the picture the crew got last.
 */
export function useSend({
  schedule,
  delivery,
  onDelivered,
  latest,
  ready,
}: {
  /** The Daily Schedule on the screen: what the Send bar is drawn for. */
  schedule: DailySchedule;
  delivery: CrewDelivery;
  /**
   * The delivery worked: the crew view the crew got, and when (the time
   * stamped on the picture). Records the Send on the Daily Schedule as it
   * stands by then, even if it is the same picture as the last Send, and
   * returns the result.
   */
  onDelivered: (sent: CrewView, sentAt: string) => DailySchedule;
  /**
   * The Roster and the Daily Schedule as they stand when the picture is made,
   * which may be later than the last draw.
   */
  latest: () => { roster: Roster; schedule: DailySchedule };
  /**
   * What a press waits for before the picture is made (a reload on its way).
   * False: there is nothing to send yet after all, and the press does nothing.
   */
  ready: () => Promise<boolean>;
}): SendState {
  const [sending, setSending] = useState(false);
  /** True from press to delivery, so a second press in between does nothing. */
  const inFlight = useRef(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const send = async () => {
    if (inFlight.current) return;

    // The moment Send was pressed: the time on the picture and in the send record.
    const pressedAt = new Date();
    inFlight.current = true;
    setSending(true);
    let view: CrewView;
    try {
      if (!(await ready())) return;
      const now = latest();
      view = crewView(now.roster, now.schedule);
      try {
        const title = sendTitle(view.date, view.updated);
        await delivery.deliver(await renderCrewPicture(view, pressedAt, now.roster), title);
      } catch (error) {
        console.error('Could not send the Daily Schedule', error);
        const message = error instanceof DeliveryFailure ? error.plain : undefined;
        setOutcome({ kind: 'failed', schedule: now.schedule, message });
        return;
      }
    } finally {
      inFlight.current = false;
      setSending(false);
    }

    setOutcome({ kind: 'sent', schedule: onDelivered(view, pressedAt.toISOString()) });
  };

  const pressed = outcome?.schedule === schedule ? outcome.kind : null;
  const failure = (pressed === 'failed' && outcome?.message) || delivery.failureMessage;
  const sentAt = lastSentAt(schedule);

  const status: SendStatus =
    pressed === 'failed'
      ? { kind: 'failed', message: failure, ...(sentAt === undefined ? {} : { sentAt }) }
      : sending
        ? { kind: 'sending' }
        : sentAt === undefined
          ? { kind: 'not-sent' }
          : {
              kind: 'sent',
              sentAt,
              // Only right after the press, and only if something is left to do.
              nextStep: pressed === 'sent' ? delivery.nextStep : '',
            };

  return { status, send: () => void send() };
}
