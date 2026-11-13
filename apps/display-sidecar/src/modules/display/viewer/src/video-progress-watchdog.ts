type Progress = {
  received: number | undefined;
  decoded: number | undefined;
  presented: number | undefined;
};

type Recovery = {
  action: "resync" | "reconnect";
  reason:
    | "video-receive-stalled"
    | "video-decode-stalled"
    | "video-presentation-stalled";
};

const stallTimeoutMs = 4_000;
const sourceEvidenceMaxAgeMs = 2_500;

/** A live socket is not proof that its video consumer is making progress. */
export class VideoProgressWatchdog {
  private sourceAt: number | null = null;
  private sourceActiveSince: number | null = null;
  private previous: Progress | null = null;
  private receivedAt = 0;
  private decodedAt = 0;
  private presentedAt = 0;
  private recoveryAt: number | null = null;

  reset(): void {
    this.sourceAt = null;
    this.sourceActiveSince = null;
    this.previous = null;
    this.recoveryAt = null;
  }

  observeSource(fps: number | undefined, now: number): void {
    if (fps === undefined || fps <= 0) {
      this.sourceActiveSince = null;
    } else if (
      this.sourceAt === null ||
      now - this.sourceAt > sourceEvidenceMaxAgeMs ||
      this.sourceActiveSince === null
    ) {
      this.sourceActiveSince = now;
    }
    this.sourceAt = now;
  }

  sample(progress: Progress, now: number): Recovery | null {
    const previous = this.previous;
    this.previous = progress;
    if (!previous || progress.received !== previous.received)
      this.receivedAt = now;
    if (!previous || progress.decoded !== previous.decoded)
      this.decodedAt = now;
    if (!previous || progress.presented !== previous.presented) {
      this.presentedAt = now;
      this.recoveryAt = null;
    }
    if (
      this.sourceActiveSince === null ||
      this.sourceAt === null ||
      now - this.sourceAt > sourceEvidenceMaxAgeMs
    ) {
      this.recoveryAt = null;
      return null;
    }
    const activeSince = this.sourceActiveSince;
    const stalled = (at: number) =>
      now - Math.max(at, activeSince) >= stallTimeoutMs;
    if (stalled(this.receivedAt)) {
      return { action: "reconnect", reason: "video-receive-stalled" };
    }
    if (!stalled(this.presentedAt)) return null;
    const reason = stalled(this.decodedAt)
      ? "video-decode-stalled"
      : "video-presentation-stalled";
    if (this.recoveryAt === null) {
      this.recoveryAt = now;
      return { action: "resync", reason };
    }
    // Configuration and decoder callbacks must not extend this deadline.
    if (now - this.recoveryAt >= stallTimeoutMs) {
      return { action: "reconnect", reason };
    }
    return null;
  }
}
