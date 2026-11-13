type PresentationChannel = Pick<
  RTCDataChannel,
  "readyState" | "bufferedAmount" | "send"
>;

/** One acknowledgement per quiet picture, scoped to the current peer attempt. */
export class WebrtcIdlePresentation {
  private timestamp: number | null = null;
  private presentedAt = 0;
  private acknowledged = false;

  presented(timestamp: number | undefined, now: number): void {
    this.timestamp = null;
    this.acknowledged = false;
    if (
      timestamp === undefined ||
      !Number.isInteger(timestamp) ||
      timestamp < 0 ||
      timestamp > 0xffffffff
    ) {
      return;
    }
    this.timestamp = timestamp;
    this.presentedAt = now;
  }

  sample(channel: PresentationChannel, now: number): void {
    const idleMs = now - this.presentedAt;
    if (
      this.timestamp === null ||
      this.acknowledged ||
      idleMs < 1_000 ||
      idleMs > 3_000 ||
      channel.readyState !== "open" ||
      channel.bufferedAmount > 0
    ) {
      return;
    }
    try {
      channel.send(
        JSON.stringify({
          type: "video-frame-presented",
          rtpTimestamp: this.timestamp,
        }),
      );
      this.acknowledged = true;
    } catch {
      // Channel recovery remains owned by the current connection attempt.
    }
  }
}
