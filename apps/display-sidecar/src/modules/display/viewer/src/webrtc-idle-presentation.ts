type PresentationChannel = Pick<
  RTCDataChannel,
  "readyState" | "bufferedAmount" | "send"
>;

export type FrameAcknowledgementStatus =
  | "callback-unavailable"
  | "waiting-for-frame"
  | "timestamp-unavailable"
  | "waiting-for-quiet"
  | "window-expired"
  | "channel-unavailable"
  | "channel-buffered"
  | "send-failed"
  | "sent";

/** One acknowledgement per quiet picture, scoped to the current peer attempt. */
export class WebrtcIdlePresentation {
  private timestamp: number | null = null;
  private presentedAt = 0;
  private sentCount = 0;
  private observation: FrameAcknowledgementStatus = "waiting-for-frame";

  diagnostics() {
    return { status: this.observation, sentCount: this.sentCount };
  }

  presented(timestamp: number | undefined, now: number): void {
    this.timestamp = null;
    if (
      timestamp === undefined ||
      !Number.isInteger(timestamp) ||
      timestamp < 0 ||
      timestamp > 0xffffffff
    ) {
      this.observation = "timestamp-unavailable";
      return;
    }
    this.timestamp = timestamp;
    this.presentedAt = now;
    this.observation = "waiting-for-quiet";
  }

  sample(channel: PresentationChannel, now: number): void {
    const idleMs = now - this.presentedAt;
    if (
      this.timestamp === null ||
      this.observation === "sent" ||
      idleMs < 1_000
    ) {
      return;
    }
    if (idleMs > 3_000) {
      if (this.observation === "waiting-for-quiet") {
        this.observation = "window-expired";
      }
      return;
    }
    if (channel.readyState !== "open") {
      this.observation = "channel-unavailable";
      return;
    }
    if (channel.bufferedAmount > 0) {
      this.observation = "channel-buffered";
      return;
    }
    try {
      channel.send(
        JSON.stringify({
          type: "video-frame-presented",
          rtpTimestamp: this.timestamp,
        }),
      );
      this.sentCount += 1;
      this.observation = "sent";
    } catch {
      this.observation = "send-failed";
      // Channel recovery remains owned by the current connection attempt.
    }
  }
}
