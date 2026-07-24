import type { ScrcpyPacket } from "./scrcpy-packet-parser";
import type { ScrcpyAudioPacket } from "./scrcpy.types";

type Completion = (error?: Error, delivered?: boolean) => void;

interface PendingVideoPacket {
  packet: ScrcpyPacket;
  discontinuity: boolean;
  completion?: Completion;
}

interface PendingAudioPacket {
  packet: ScrcpyAudioPacket;
  discontinuity: boolean;
  completion?: Completion;
}

export interface MediaQueueSnapshot {
  queuedFrames: number;
  queuedBytes: number;
  queueDepthMs: number;
  droppedFrames: number;
  awaitingKeyFrame: boolean;
}

const maxVideoFrames = 3;
const maxVideoSpanUs = 75_000n;
const defaultKeyFrameRecoveryTimeoutMs = 1_500;
const maxAudioSpanUs = 100_000n;
const maxAudioFrames = 8;

interface GopAwareVideoQueueOptions {
  keyFrameRecoveryTimeoutMs?: number;
  onRecoveryTimeout?: (error: Error) => void;
}

function errorFrom(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export class GopAwareVideoQueue {
  private queue: PendingVideoPacket[] = [];
  private cachedConfig: ScrcpyPacket | null = null;
  private draining = false;
  private closed = false;
  private awaitingKeyFrame = true;
  private droppedFrames = 0;
  private recoveryStartTimestampUs: bigint | null = null;

  constructor(
    private readonly write: (
      packet: ScrcpyPacket,
      discontinuity: boolean,
    ) => Promise<void>,
    private readonly onResync: (timestampUs: bigint) => void,
    private readonly options: GopAwareVideoQueueOptions = {},
  ) {}

  push(packet: ScrcpyPacket, completion?: Completion): void {
    if (this.closed) {
      completion?.(new Error("media queue is closed"));
      return;
    }
    if (packet.config) {
      if (!this.awaitingKeyFrame) {
        this.dropQueuedVideo();
        this.beginKeyFrameRecovery(null);
      }
      this.cachedConfig = {
        ...packet,
        data: Buffer.from(packet.data),
      };
      completion?.();
      return;
    }

    if (this.awaitingKeyFrame) {
      if (!packet.keyFrame) {
        this.droppedFrames += 1;
        completion?.(undefined, false);
        this.checkRecoveryProgress(packet.timestampUs);
        return;
      }
      this.enqueueResync(packet, completion);
      return;
    }

    if (this.wouldOverflow(packet)) {
      this.dropQueuedVideo();
      this.beginKeyFrameRecovery(packet.timestampUs);
      if (!packet.keyFrame) {
        this.droppedFrames += 1;
        completion?.(undefined, false);
        return;
      }
      this.enqueueResync(packet, completion);
      return;
    }

    this.queue.push({ packet, discontinuity: false, completion });
    this.startDrain();
  }

  close(error = new Error("media queue closed")): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const pending of this.queue.splice(0)) {
      pending.completion?.(error);
    }
  }

  snapshot(): MediaQueueSnapshot {
    const mediaPackets = this.queue.filter(({ packet }) => !packet.config);
    const first = mediaPackets[0]?.packet.timestampUs;
    const last = mediaPackets.at(-1)?.packet.timestampUs;
    return {
      queuedFrames: mediaPackets.length,
      queuedBytes: this.queue.reduce(
        (total, { packet }) => total + packet.data.byteLength,
        0,
      ),
      queueDepthMs:
        first !== undefined && last !== undefined && last >= first
          ? Number(last - first) / 1_000
          : 0,
      droppedFrames: this.droppedFrames,
      awaitingKeyFrame: this.awaitingKeyFrame,
    };
  }

  private enqueueResync(packet: ScrcpyPacket, completion?: Completion): void {
    this.recoveryStartTimestampUs = null;
    if (this.cachedConfig) {
      this.queue.push({
        packet: this.cachedConfig,
        discontinuity: true,
      });
    }
    this.queue.push({ packet, discontinuity: true, completion });
    this.awaitingKeyFrame = false;
    this.onResync(packet.timestampUs);
    this.startDrain();
  }

  private beginKeyFrameRecovery(timestampUs: bigint | null): void {
    if (this.awaitingKeyFrame) {
      this.recoveryStartTimestampUs ??= timestampUs;
      return;
    }
    this.awaitingKeyFrame = true;
    this.recoveryStartTimestampUs = timestampUs;
  }

  private checkRecoveryProgress(timestampUs: bigint): void {
    this.recoveryStartTimestampUs ??= timestampUs;
    if (timestampUs < this.recoveryStartTimestampUs) {
      this.recoveryStartTimestampUs = timestampUs;
      return;
    }
    const timeoutMs =
      this.options.keyFrameRecoveryTimeoutMs ??
      defaultKeyFrameRecoveryTimeoutMs;
    if (
      timestampUs - this.recoveryStartTimestampUs <=
      BigInt(timeoutMs) * 1_000n
    ) {
      return;
    }
    const error = new Error(
      `RBD1 video PTS advanced for more than ${timeoutMs} ms without a keyframe`,
    );
    this.close(error);
    this.options.onRecoveryTimeout?.(error);
  }

  private wouldOverflow(packet: ScrcpyPacket): boolean {
    const mediaPackets = this.queue.filter(
      ({ packet: queued }) => !queued.config,
    );
    if (mediaPackets.length >= maxVideoFrames) {
      return true;
    }
    const firstTimestamp = mediaPackets[0]?.packet.timestampUs;
    return (
      firstTimestamp !== undefined &&
      packet.timestampUs >= firstTimestamp &&
      packet.timestampUs - firstTimestamp > maxVideoSpanUs
    );
  }

  private dropQueuedVideo(): void {
    for (const pending of this.queue.splice(0)) {
      if (!pending.packet.config) {
        this.droppedFrames += 1;
      }
      pending.completion?.(undefined, false);
    }
  }

  private startDrain(): void {
    if (this.draining || this.closed) {
      return;
    }
    this.draining = true;
    void this.drain();
  }

  private async drain(): Promise<void> {
    while (!this.closed) {
      const pending = this.queue.shift();
      if (!pending) {
        break;
      }
      try {
        await this.write(pending.packet, pending.discontinuity);
        pending.completion?.(undefined, true);
      } catch (error) {
        const failure = errorFrom(error);
        pending.completion?.(failure);
        this.close(failure);
        break;
      }
    }
    this.draining = false;
    if (this.queue.length > 0) {
      this.startDrain();
    }
  }
}

export class BoundedAudioQueue {
  private queue: PendingAudioPacket[] = [];
  private draining = false;
  private closed = false;
  private droppedFrames = 0;
  private discontinuityPending = false;

  constructor(
    private readonly write: (
      packet: ScrcpyAudioPacket,
      discontinuity: boolean,
    ) => Promise<void>,
  ) {}

  push(packet: ScrcpyAudioPacket, completion?: Completion): void {
    if (this.closed) {
      completion?.(new Error("audio queue is closed"));
      return;
    }
    const discontinuity = !packet.config && this.discontinuityPending;
    if (discontinuity) {
      this.discontinuityPending = false;
    }
    this.queue.push({ packet, discontinuity, completion });
    this.trimToLatency();
    this.startDrain();
  }

  discardBefore(timestampUs: bigint): void {
    const retained: PendingAudioPacket[] = [];
    for (const pending of this.queue) {
      if (pending.packet.config || pending.packet.timestampUs >= timestampUs) {
        retained.push(pending);
      } else {
        this.droppedFrames += 1;
        pending.completion?.();
      }
    }
    this.queue = retained;
    this.markDiscontinuity();
  }

  private markDiscontinuity(): void {
    const firstMedia = this.queue.find(({ packet }) => !packet.config);
    if (firstMedia) {
      firstMedia.discontinuity = true;
    } else {
      this.discontinuityPending = true;
    }
  }

  close(error = new Error("audio queue closed")): void {
    this.closed = true;
    for (const pending of this.queue.splice(0)) {
      pending.completion?.(error);
    }
  }

  snapshot(): MediaQueueSnapshot {
    const mediaPackets = this.queue.filter(({ packet }) => !packet.config);
    const first = mediaPackets[0]?.packet.timestampUs;
    const last = mediaPackets.at(-1)?.packet.timestampUs;
    return {
      queuedFrames: mediaPackets.length,
      queuedBytes: this.queue.reduce(
        (total, { packet }) => total + packet.data.byteLength,
        0,
      ),
      queueDepthMs:
        first !== undefined && last !== undefined && last >= first
          ? Number(last - first) / 1_000
          : 0,
      droppedFrames: this.droppedFrames,
      awaitingKeyFrame: false,
    };
  }

  private trimToLatency(): void {
    const mediaPackets = () =>
      this.queue.filter(({ packet }) => !packet.config);
    let packets = mediaPackets();
    let droppedMedia = false;
    while (
      packets.length > 1 &&
      (packets.length > maxAudioFrames ||
        packets.at(-1)!.packet.timestampUs < packets[0]!.packet.timestampUs ||
        packets.at(-1)!.packet.timestampUs - packets[0]!.packet.timestampUs >
          maxAudioSpanUs)
    ) {
      const index = this.queue.findIndex(({ packet }) => !packet.config);
      const [dropped] = this.queue.splice(index, 1);
      this.droppedFrames += 1;
      dropped?.completion?.();
      packets = mediaPackets();
      droppedMedia = true;
    }
    if (droppedMedia) {
      this.markDiscontinuity();
    }
  }

  private startDrain(): void {
    if (this.draining || this.closed) {
      return;
    }
    this.draining = true;
    void this.drain();
  }

  private async drain(): Promise<void> {
    while (!this.closed) {
      const pending = this.queue.shift();
      if (!pending) {
        break;
      }
      try {
        await this.write(pending.packet, pending.discontinuity);
        pending.completion?.();
      } catch (error) {
        const failure = errorFrom(error);
        pending.completion?.(failure);
        this.close(failure);
        break;
      }
    }
    this.draining = false;
    if (this.queue.length > 0) {
      this.startDrain();
    }
  }
}
