import { randomUUID } from "node:crypto";
import type { ScrcpyPacket } from "./scrcpy-packet-parser";
import type {
  ScrcpyAudioPacket,
  ScrcpyMediaSink,
  ScrcpyMediaSinkSnapshot,
  ScrcpyStreamAttachment,
  ScrcpyVideoBootstrap,
} from "./scrcpy.types";
import { inspectScrcpyH264Configuration } from "./scrcpy-h264-profile";

const MAX_CACHED_GOP_SPAN_US = 2_000_000n;
const MAX_CACHED_GOP_BYTES = 16 * 1024 * 1024;

interface Consumer {
  id: string;
  sink: ScrcpyMediaSink;
  resolveClosed: () => void;
  detached: boolean;
}

interface BootstrapWaiter {
  resolve: (bootstrap: ScrcpyVideoBootstrap) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

function emptyQueue(awaitingKeyFrame: boolean) {
  return {
    queuedFrames: 0,
    queuedBytes: 0,
    queueDepthMs: 0,
    droppedFrames: 0,
    awaitingKeyFrame,
  };
}

export class ScrcpySourceStream implements ScrcpyMediaSink {
  readonly sourceAttemptId = randomUUID();
  private readonly consumers = new Map<string, Consumer>();
  private readonly closeListeners = new Set<
    (code?: number, reason?: Buffer) => void
  >();
  private cachedConfig: ScrcpyPacket | null = null;
  private cachedGop: ScrcpyPacket[] = [];
  private cachedGopBytes = 0;
  private readonly cachedStatuses = new Map<string, unknown>();
  private readonly bootstrapWaiters = new Set<BootstrapWaiter>();
  private actualEncoder: string | undefined;
  private sourceVideoFrames = 0;
  private closed = false;

  constructor(
    private readonly onEmpty: () => void,
    private readonly onConsumerAdded: () => void,
    private readonly requestReset: (reason: string) => boolean,
  ) {}

  attach(sink: ScrcpyMediaSink): ScrcpyStreamAttachment {
    if (this.closed) {
      throw new Error("scrcpy source is closed");
    }
    const consumerId = randomUUID();
    let resolveClosed!: () => void;
    const closed = new Promise<void>((resolve) => {
      resolveClosed = resolve;
    });
    const consumer: Consumer = {
      id: consumerId,
      sink,
      resolveClosed,
      detached: false,
    };
    this.consumers.set(consumerId, consumer);
    sink.onClose(() => this.detachConsumer(consumerId, false));
    this.replayCachedStatuses(sink);
    this.replayCachedGop(sink);
    this.onConsumerAdded();

    return {
      sourceAttemptId: this.sourceAttemptId,
      consumerId,
      closed,
      detach: (reason = "display consumer detached") => {
        if (!consumer.detached && consumer.sink.isOpen()) {
          consumer.sink.close(1000, reason);
        }
        this.detachConsumer(consumerId, false);
      },
      requestVideoReset: this.requestReset,
      awaitVideoBootstrap: (timeoutMs = 3_000) =>
        this.awaitVideoBootstrap(timeoutMs),
    };
  }

  consumerCount(): number {
    return this.consumers.size;
  }

  isOpen(): boolean {
    return !this.closed;
  }

  onClose(listener: (code?: number, reason?: Buffer) => void): void {
    this.closeListeners.add(listener);
  }

  sendStatus(payload: unknown): void {
    this.cacheStatus(payload);
    for (const consumer of this.openConsumers()) {
      consumer.sink.sendStatus(payload);
    }
  }

  setActualEncoder(actualEncoder: string): void {
    this.actualEncoder = actualEncoder;
  }

  writeVideo(packet: ScrcpyPacket, completion?: (error?: Error) => void): void {
    this.cacheVideoPacket(packet);
    this.resolveBootstrapWaiters();
    if (!packet.config) {
      this.sourceVideoFrames += 1;
    }
    for (const consumer of this.openConsumers()) {
      consumer.sink.writeVideo(packet, (error) => {
        if (error) {
          this.detachConsumer(consumer.id, true, error.message);
        }
      });
    }
    completion?.();
  }

  writeAudio(
    packet: ScrcpyAudioPacket,
    completion?: (error?: Error) => void,
  ): void {
    for (const consumer of this.openConsumers()) {
      consumer.sink.writeAudio(packet, (error) => {
        if (error) {
          this.detachConsumer(consumer.id, true, error.message);
        }
      });
    }
    completion?.();
  }

  snapshot(): ScrcpyMediaSinkSnapshot {
    const snapshots = this.openConsumers().map(({ sink }) => sink.snapshot());
    return {
      sourceVideoFrames: this.sourceVideoFrames,
      sourceVideoBytes: snapshots[0]?.sourceVideoBytes ?? 0,
      sourceKeyFrames: snapshots[0]?.sourceKeyFrames ?? 0,
      lastKeyFrameBytes: snapshots[0]?.lastKeyFrameBytes ?? 0,
      sourceFrameSizeP95Bytes: snapshots[0]?.sourceFrameSizeP95Bytes ?? 0,
      sourceInterFrameP95Ms: snapshots[0]?.sourceInterFrameP95Ms ?? 0,
      lastVideoSequence: snapshots[0]?.lastVideoSequence,
      video: snapshots[0]?.video ?? emptyQueue(true),
      audio: snapshots[0]?.audio ?? emptyQueue(false),
      scrcpyReadToSinkWriteP95Ms: Math.max(
        0,
        ...snapshots.map(
          (snapshot) => snapshot.scrcpyReadToSinkWriteP95Ms ?? 0,
        ),
      ),
      scrcpyReadToSinkWriteP99Ms: Math.max(
        0,
        ...snapshots.map(
          (snapshot) => snapshot.scrcpyReadToSinkWriteP99Ms ?? 0,
        ),
      ),
      eventLoopUtilization: Math.max(
        0,
        ...snapshots.map((snapshot) => snapshot.eventLoopUtilization ?? 0),
      ),
      gcPauseP95Ms: Math.max(
        0,
        ...snapshots.map((snapshot) => snapshot.gcPauseP95Ms ?? 0),
      ),
    };
  }

  close(code = 1000, reason = "scrcpy source closed"): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const consumer of [...this.consumers.values()]) {
      if (consumer.sink.isOpen()) {
        consumer.sink.close(code, reason);
      }
      this.detachConsumer(consumer.id, false);
    }
    const reasonBuffer = Buffer.from(reason);
    for (const listener of this.closeListeners) {
      listener(code, reasonBuffer);
    }
    this.closeListeners.clear();
    this.cachedConfig = null;
    this.cachedGop = [];
    this.cachedGopBytes = 0;
    for (const waiter of this.bootstrapWaiters) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error("scrcpy source closed before video bootstrap"));
    }
    this.bootstrapWaiters.clear();
    this.cachedStatuses.clear();
  }

  private openConsumers(): Consumer[] {
    const open: Consumer[] = [];
    for (const consumer of this.consumers.values()) {
      if (consumer.sink.isOpen()) {
        open.push(consumer);
      } else {
        this.detachConsumer(consumer.id, false);
      }
    }
    return open;
  }

  private detachConsumer(
    consumerId: string,
    closeSink: boolean,
    reason = "display consumer failed",
  ): void {
    const consumer = this.consumers.get(consumerId);
    if (!consumer || consumer.detached) {
      return;
    }
    consumer.detached = true;
    this.consumers.delete(consumerId);
    if (closeSink && consumer.sink.isOpen()) {
      consumer.sink.close(1011, reason);
    }
    consumer.resolveClosed();
    if (!this.closed && this.consumers.size === 0) {
      this.onEmpty();
    }
  }

  private cacheVideoPacket(packet: ScrcpyPacket): void {
    const copy = { ...packet, data: Buffer.from(packet.data) };
    if (packet.config) {
      this.cachedConfig = copy;
      return;
    }
    if (packet.keyFrame) {
      this.cachedGop = [copy];
      this.cachedGopBytes = copy.data.byteLength;
      return;
    }
    const first = this.cachedGop[0];
    if (!first) {
      return;
    }
    const span =
      packet.timestampUs >= first.timestampUs
        ? packet.timestampUs - first.timestampUs
        : MAX_CACHED_GOP_SPAN_US + 1n;
    if (
      span > MAX_CACHED_GOP_SPAN_US ||
      this.cachedGopBytes + copy.data.byteLength > MAX_CACHED_GOP_BYTES
    ) {
      this.cachedGop = [];
      this.cachedGopBytes = 0;
      return;
    }
    this.cachedGop.push(copy);
    this.cachedGopBytes += copy.data.byteLength;
  }

  private awaitVideoBootstrap(
    timeoutMs: number,
  ): Promise<ScrcpyVideoBootstrap> {
    let bootstrap: ScrcpyVideoBootstrap | null;
    try {
      bootstrap = this.videoBootstrap();
    } catch (error) {
      return Promise.reject(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
    if (bootstrap) {
      return Promise.resolve(bootstrap);
    }
    return new Promise((resolve, reject) => {
      const waiter: BootstrapWaiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          this.bootstrapWaiters.delete(waiter);
          reject(
            new Error(
              `Timed out waiting ${timeoutMs}ms for H.264 configuration and IDR`,
            ),
          );
        }, timeoutMs),
      };
      waiter.timer.unref?.();
      this.bootstrapWaiters.add(waiter);
    });
  }

  private videoBootstrap(): ScrcpyVideoBootstrap | null {
    const keyFrame = this.cachedGop[0];
    if (!this.cachedConfig || !keyFrame?.keyFrame) {
      return null;
    }
    const inspected = inspectScrcpyH264Configuration(this.cachedConfig);
    return {
      configuration: Buffer.from(this.cachedConfig.data),
      keyFrame: Buffer.from(keyFrame.data),
      configurationTimestampUs: this.cachedConfig.timestampUs,
      keyFrameTimestampUs: keyFrame.timestampUs,
      actualEncoder: this.actualEncoder,
      ...inspected,
    };
  }

  private resolveBootstrapWaiters(): void {
    if (this.bootstrapWaiters.size === 0) {
      return;
    }
    let bootstrap: ScrcpyVideoBootstrap | null;
    try {
      bootstrap = this.videoBootstrap();
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      for (const waiter of this.bootstrapWaiters) {
        clearTimeout(waiter.timer);
        waiter.reject(failure);
      }
      this.bootstrapWaiters.clear();
      return;
    }
    if (!bootstrap) {
      return;
    }
    for (const waiter of this.bootstrapWaiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(bootstrap);
    }
    this.bootstrapWaiters.clear();
  }

  private cacheStatus(payload: unknown): void {
    if (!payload || typeof payload !== "object") {
      return;
    }
    const type = (payload as Record<string, unknown>).type;
    if (
      type === "ready" ||
      type === "encoder" ||
      type === "compatibility" ||
      type === "audio-disabled"
    ) {
      this.cachedStatuses.set(String(type), payload);
    }
  }

  private replayCachedStatuses(sink: ScrcpyMediaSink): void {
    for (const payload of this.cachedStatuses.values()) {
      sink.sendStatus(payload);
    }
  }

  private replayCachedGop(sink: ScrcpyMediaSink): void {
    if (this.cachedConfig) {
      sink.writeVideo(this.cachedConfig);
    }
    for (const packet of this.cachedGop) {
      sink.writeVideo(packet);
    }
  }
}
