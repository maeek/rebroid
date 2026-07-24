import type { ScrcpyPacket } from "./scrcpy-packet-parser";
import { performance, PerformanceObserver } from "node:perf_hooks";
import {
  audioMediaFrame,
  encodeRebroidMediaFrame,
  videoMediaFrame,
} from "./scrcpy-media-frame";
import { BoundedAudioQueue, GopAwareVideoQueue } from "./scrcpy-media-queue";
import type {
  ScrcpyAudioPacket,
  ScrcpyMediaSink,
  ScrcpyMediaSinkSnapshot,
} from "./scrcpy.types";

type BinaryWriter = (payload: Buffer) => Promise<void>;

export interface QueuedScrcpyMediaSinkOptions {
  isOpen: () => boolean;
  onClose: (listener: (code?: number, reason?: Buffer) => void) => void;
  writeStatus: (payload: string) => void;
  writeVideo: BinaryWriter;
  writeAudio: BinaryWriter;
  close: (code?: number, reason?: string) => void;
}

export class QueuedScrcpyMediaSink implements ScrcpyMediaSink {
  private sourceVideoFrames = 0;
  private sourceVideoBytes = 0;
  private sourceKeyFrames = 0;
  private lastKeyFrameBytes = 0;
  private readonly sourceFrameSizes: number[] = [];
  private readonly sourceInterFrameMs: number[] = [];
  private lastSourceTimestampUs: bigint | null = null;
  private videoSequence = 0;
  private audioSequence = 0;
  private readonly audioQueue: BoundedAudioQueue;
  private readonly videoQueue: GopAwareVideoQueue;
  private closed = false;
  private readonly videoRelayLatenciesMs: number[] = [];
  private previousEventLoopUtilization = performance.eventLoopUtilization();
  private readonly gcPausesMs: number[] = [];
  private readonly gcObserver = new PerformanceObserver((entries) => {
    for (const entry of entries.getEntries()) {
      this.gcPausesMs.push(entry.duration);
      if (this.gcPausesMs.length > 600) {
        this.gcPausesMs.shift();
      }
    }
  });

  constructor(private readonly options: QueuedScrcpyMediaSinkOptions) {
    this.gcObserver.observe({ entryTypes: ["gc"] });
    this.audioQueue = new BoundedAudioQueue((packet, discontinuity) =>
      this.options.writeAudio(
        encodeRebroidMediaFrame(
          audioMediaFrame(packet, this.audioSequence++, discontinuity),
        ),
      ),
    );
    this.videoQueue = new GopAwareVideoQueue(
      (packet, discontinuity) =>
        this.options.writeVideo(
          encodeRebroidMediaFrame(
            videoMediaFrame(packet, this.videoSequence++, discontinuity),
          ),
        ),
      (timestampUs) => this.audioQueue.discardBefore(timestampUs),
      {
        onRecoveryTimeout: (error) => this.close(1011, error.message),
      },
    );
  }

  isOpen(): boolean {
    return !this.closed && this.options.isOpen();
  }

  onClose(listener: (code?: number, reason?: Buffer) => void): void {
    this.options.onClose((code, reason) => {
      this.closed = true;
      this.videoQueue.close();
      this.audioQueue.close();
      this.gcObserver.disconnect();
      listener(code, reason);
    });
  }

  sendStatus(payload: unknown): void {
    if (this.isOpen()) {
      this.options.writeStatus(JSON.stringify(payload));
    }
  }

  writeVideo(packet: ScrcpyPacket, completion?: (error?: Error) => void): void {
    if (!packet.config) {
      this.sourceVideoFrames += 1;
      this.sourceVideoBytes += packet.data.byteLength;
      this.sourceFrameSizes.push(packet.data.byteLength);
      if (this.sourceFrameSizes.length > 600) {
        this.sourceFrameSizes.shift();
      }
      if (packet.keyFrame) {
        this.sourceKeyFrames += 1;
        this.lastKeyFrameBytes = packet.data.byteLength;
      }
      if (
        this.lastSourceTimestampUs !== null &&
        packet.timestampUs >= this.lastSourceTimestampUs
      ) {
        this.sourceInterFrameMs.push(
          Number(packet.timestampUs - this.lastSourceTimestampUs) / 1_000,
        );
        if (this.sourceInterFrameMs.length > 600) {
          this.sourceInterFrameMs.shift();
        }
      }
      this.lastSourceTimestampUs = packet.timestampUs;
    }
    const enqueuedAt = performance.now();
    this.videoQueue.push(packet, (error, delivered) => {
      if (!error && delivered) {
        this.recordVideoRelayLatency(performance.now() - enqueuedAt);
      }
      completion?.(error);
    });
  }

  writeAudio(
    packet: ScrcpyAudioPacket,
    completion?: (error?: Error) => void,
  ): void {
    this.audioQueue.push(packet, completion);
  }

  snapshot(): ScrcpyMediaSinkSnapshot {
    return {
      sourceVideoFrames: this.sourceVideoFrames,
      sourceVideoBytes: this.sourceVideoBytes,
      sourceKeyFrames: this.sourceKeyFrames,
      lastKeyFrameBytes: this.lastKeyFrameBytes,
      sourceFrameSizeP95Bytes: this.percentile(this.sourceFrameSizes, 0.95),
      sourceInterFrameP95Ms: this.percentile(this.sourceInterFrameMs, 0.95),
      lastVideoSequence:
        this.videoSequence === 0 ? undefined : (this.videoSequence - 1) >>> 0,
      video: this.videoQueue.snapshot(),
      audio: this.audioQueue.snapshot(),
      scrcpyReadToSinkWriteP95Ms: this.videoRelayLatencyP95(),
      scrcpyReadToSinkWriteP99Ms: this.percentile(
        this.videoRelayLatenciesMs,
        0.99,
      ),
      eventLoopUtilization: this.sampleEventLoopUtilization(),
      gcPauseP95Ms: this.percentile(this.gcPausesMs, 0.95),
    };
  }

  close(code?: number, reason?: string): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.videoQueue.close();
    this.audioQueue.close();
    this.gcObserver.disconnect();
    this.options.close(code, reason);
  }

  private recordVideoRelayLatency(value: number): void {
    this.videoRelayLatenciesMs.push(value);
    if (this.videoRelayLatenciesMs.length > 600) {
      this.videoRelayLatenciesMs.shift();
    }
  }

  private videoRelayLatencyP95(): number {
    return this.percentile(this.videoRelayLatenciesMs, 0.95);
  }

  private percentile(values: number[], percentileValue: number): number {
    if (values.length === 0) {
      return 0;
    }
    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.ceil(sorted.length * percentileValue) - 1;
    return sorted[Math.max(0, index)] ?? 0;
  }

  private sampleEventLoopUtilization(): number {
    const sample = performance.eventLoopUtilization(
      this.previousEventLoopUtilization,
    );
    this.previousEventLoopUtilization = performance.eventLoopUtilization();
    return sample.utilization;
  }
}
