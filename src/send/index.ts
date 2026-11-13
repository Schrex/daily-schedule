/**
 * Delivery: how the picture of the Daily Schedule reaches the crew.
 *
 * `CrewDelivery` is the whole interface. When Slack is connected on the
 * Daily Schedule's server the picture goes to the server, which posts it to
 * the crew's Slack channel through the Slack relay (serverDelivery.ts); only
 * when it is not connected is the picture copied to the clipboard for the
 * Scheduler to paste into Slack (clipboardDelivery.ts). No rules live here:
 * whether Send is allowed, the send record and what the picture contains all
 * belong to the schedule rules.
 */

export interface CrewDelivery {
  /**
   * Delivers the picture (a PNG). Resolves only once it has been delivered;
   * rejects if it could not be, in which case no Send is recorded.
   */
  deliver(picture: Blob, title: string): Promise<void>;
  /** What the Scheduler still has to do after a delivery, in plain words. Empty if nothing. */
  nextStep: string;
  /**
   * What to tell the Scheduler when a delivery fails, in plain words, unless
   * the delivery rejected with a `DeliveryFailure`, whose own words are used.
   */
  failureMessage: string;
}

/** A failed delivery that knows what to tell the Scheduler, in plain words. */
export class DeliveryFailure extends Error {
  constructor(readonly plain: string) {
    super(plain);
  }
}
