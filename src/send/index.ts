/**
 * Delivery: how the picture of the Daily Schedule reaches the crew.
 *
 * `CrewDelivery` is the whole interface. Today the picture is copied to the
 * clipboard for the Scheduler to paste into Slack (clipboardDelivery.ts);
 * posting to Slack automatically can replace that by implementing the same
 * interface. No rules live here: whether Send is allowed, the send record and
 * what the picture contains all belong to the schedule rules.
 */

export interface CrewDelivery {
  /**
   * Delivers the picture (a PNG). Resolves only once it has been delivered;
   * rejects if it could not be, in which case no Send is recorded.
   */
  deliver(picture: Blob): Promise<void>;
  /** What the Scheduler still has to do after a delivery, in plain words. Empty if nothing. */
  nextStep: string;
  /** What to tell the Scheduler when a delivery fails, in plain words. */
  failureMessage: string;
}
