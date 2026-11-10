import { useState } from 'react';
import {
  crewView,
  lastSentAt,
  markSent,
  sendCheck,
  type CrewMember,
  type DailySchedule,
  type Roster,
} from '../schedule-rules';
import type { CrewDelivery } from '../send';
import { renderCrewPicture } from '../send/crewPicture';

/** What the Send bar shows. Exactly one of `refused`, `failure` and `justSent` is set, or none. */
export interface SendState {
  /** True while the picture is being drawn and delivered. */
  sending: boolean;
  /** Send was refused for this Daily Schedule: the Crew Members who are Not Placed. */
  refused: CrewMember[] | null;
  /** The last Send could not be delivered: what to tell the Scheduler. */
  failure: string | null;
  /** This Daily Schedule was sent just now and not changed since: what he does next. */
  justSent: { nextStep: string } | null;
  /** When the Daily Schedule was last sent (from its send record), if ever. */
  sentAt: string | undefined;
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
 * worked hand back the Daily Schedule marked as Sent through `onSent`.
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
  onSent,
}: {
  roster: Roster;
  schedule: DailySchedule;
  delivery: CrewDelivery;
  /** The delivery worked: the Daily Schedule, marked as Sent, to keep and save. */
  onSent: (sent: DailySchedule) => void;
}): SendState {
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const send = async () => {
    if (sending) return;
    if (!sendCheck(roster, schedule).allowed) {
      setOutcome({ kind: 'refused', schedule });
      return;
    }

    const view = crewView(roster, schedule);
    setSending(true);
    try {
      await delivery.deliver(await renderCrewPicture(view));
    } catch (error) {
      console.error('Could not send the Daily Schedule', error);
      setOutcome({ kind: 'failed', schedule });
      return;
    } finally {
      setSending(false);
    }

    const sent = markSent(schedule, view, new Date().toISOString());
    setOutcome({ kind: 'sent', schedule: sent });
    onSent(sent);
  };

  const current = outcome?.schedule === schedule ? outcome.kind : null;

  return {
    sending,
    refused: current === 'refused' ? sendCheck(roster, schedule).notPlaced : null,
    failure: current === 'failed' ? delivery.failureMessage : null,
    justSent: current === 'sent' ? { nextStep: delivery.nextStep } : null,
    sentAt: lastSentAt(schedule),
    send: () => void send(),
  };
}
