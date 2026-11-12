import type { ViewerMediaFrame } from "./media-frame.js";

type PendingFrame = {
  frame: ViewerMediaFrame;
  receivedAt: number;
  bytes: number;
};

export class MediaIngressQueue {
  private readonly pending: PendingFrame[] = [];
  private queuedBytes = 0;
  private activeBytes = 0;
  private draining = false;
  private closed = false;
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly limits: { bytes: number; frames: number; ageMs: number },
    private readonly consume: (
      frame: ViewerMediaFrame,
      expiresAt: number,
    ) => Promise<void>,
    private readonly onExpired: (dropped: number) => void,
    private readonly onError: (error: unknown) => void,
  ) {}

  offer(frame: ViewerMediaFrame, receivedAt: number): boolean {
    const bytes = frame.data.buffer.byteLength;
    if (
      this.closed ||
      this.queuedBytes + this.activeBytes + bytes > this.limits.bytes ||
      this.pending.length + Number(this.activeBytes > 0) >= this.limits.frames
    ) {
      return false;
    }
    this.pending.push({ frame, receivedAt, bytes });
    this.queuedBytes += bytes;
    if (this.draining) {
      this.armExpiry();
    } else {
      this.draining = true;
      void this.drain();
    }
    return true;
  }

  clear(): number {
    const dropped = this.pending.length;
    this.pending.length = 0;
    this.queuedBytes = 0;
    this.clearExpiry();
    return dropped;
  }

  close(): void {
    this.closed = true;
    this.clear();
  }

  private armExpiry(): void {
    const oldest = this.pending[0];
    if (!oldest || this.expiryTimer !== undefined) return;
    this.expiryTimer = setTimeout(
      () => {
        this.expiryTimer = undefined;
        this.onExpired(this.clear());
      },
      Math.max(
        0,
        Math.ceil(oldest.receivedAt + this.limits.ageMs - performance.now()),
      ),
    );
  }

  private clearExpiry(): void {
    clearTimeout(this.expiryTimer);
    this.expiryTimer = undefined;
  }

  private async drain(): Promise<void> {
    try {
      while (!this.closed) {
        const next = this.pending[0];
        if (!next) return;
        const expiresAt = next.receivedAt + this.limits.ageMs;
        if (performance.now() >= expiresAt) {
          this.onExpired(this.clear());
          continue;
        }
        this.pending.shift();
        this.queuedBytes -= next.bytes;
        this.clearExpiry();
        this.armExpiry();
        this.activeBytes = next.bytes;
        try {
          await this.consume(next.frame, expiresAt);
        } finally {
          this.activeBytes = 0;
        }
      }
    } catch (error) {
      if (!this.closed) this.onError(error);
    } finally {
      this.draining = false;
    }
  }
}
