type VideoFrameCallbackMetadata = {
  mediaTime?: number;
  presentedFrames?: number;
};

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: VideoFrameCallbackMetadata) => void,
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export interface MseMediaSegment {
  segment: ArrayBuffer;
  durationMs: number;
  sourcePtsOriginUs: number;
  samples: Array<{ sequence: number; timestampUs: number }>;
}

export interface MseMetricsSnapshot {
  decodedFps?: number;
  drawnFps: number;
  presentedFps: number;
  frameGapP50Ms?: number;
  frameGapP95Ms?: number;
  frameGapP99Ms?: number;
  frameGapMaxMs?: number;
  mseBufferedLeadMs?: number;
  jitterBufferTargetMs: number;
  presentationDroppedFrames: number;
  freezeCount: number;
  highestDecodedSequence?: number;
  highestPresentedSequence?: number;
  highestPresentedTimestampUs?: number;
}

interface QueuedSegment {
  data: ArrayBuffer;
  queueCostMs: number;
  media: boolean;
}

const maximumAppendQueueMs = 500;
const maximumAppendQueueBytes = 16 * 1024 * 1024;
const maximumHistoryMs = 500;
const minimumTargetMs = 20;
const maximumTargetMs = 40;
const nominalFrameDurationMs = 1_000 / 60;

function percentile(
  values: number[],
  percentileValue: number,
): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1),
  );
  return sorted[index];
}

export class MseVideoPlayer {
  private mediaSource: MediaSource | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private objectUrl: string | null = null;
  private readonly queue: QueuedSegment[] = [];
  private queuedMediaMs = 0;
  private queuedMediaBytes = 0;
  private sourcePtsOriginUs = 0;
  private markers: Array<{
    mediaTime: number;
    sequence: number;
  }> = [];
  private frameCallbackHandle: number | null = null;
  private firstFramePresented = false;
  private presentedFrames = 0;
  private lastReportedPresentedFrames = 0;
  private lastReportedDecodedFrames = 0;
  private lastReportedDroppedFrames = 0;
  private lastMetricsAt = performance.now();
  private lastPresentedAt: number | null = null;
  private frameGapsMs: number[] = [];
  private freezeCount = 0;
  private freezeActive = false;
  private highestPresentedSequence: number | undefined;
  private highestPresentedTimestampUs: number | undefined;
  private highestDecodedSequence: number | undefined;
  private targetMs = minimumTargetMs;
  private stableSamples = 0;
  private bufferedLeadMs = 0;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly onFirstFrame: () => void,
    private readonly onResync: (reason: string) => void,
  ) {}

  static supports(codec: string): boolean {
    return (
      "MediaSource" in window &&
      MediaSource.isTypeSupported(`video/mp4; codecs="${codec}"`)
    );
  }

  initialize(
    codec: string,
    initializationSegment: ArrayBuffer,
    sourcePtsOriginUs: number,
  ): void {
    if (!MseVideoPlayer.supports(codec)) {
      throw new Error(`Firefox MediaSource does not support ${codec}.`);
    }
    this.stopFrameCallbacks();
    this.resetMediaSource();
    this.sourcePtsOriginUs = sourcePtsOriginUs;
    this.markers = [];
    this.highestDecodedSequence = undefined;
    this.highestPresentedSequence = undefined;
    this.highestPresentedTimestampUs = undefined;
    this.firstFramePresented = false;
    const mediaSource = new MediaSource();
    this.mediaSource = mediaSource;
    this.objectUrl = URL.createObjectURL(mediaSource);
    this.video.srcObject = null;
    this.video.src = this.objectUrl;
    this.video.muted = true;
    this.video.autoplay = true;
    this.video.playsInline = true;
    this.queue.push({
      data: initializationSegment,
      queueCostMs: 0,
      media: false,
    });
    mediaSource.addEventListener(
      "sourceopen",
      () => {
        if (this.mediaSource !== mediaSource) {
          return;
        }
        try {
          const sourceBuffer = mediaSource.addSourceBuffer(
            `video/mp4; codecs="${codec}"`,
          );
          sourceBuffer.mode = "segments";
          sourceBuffer.addEventListener("updateend", () => {
            if (
              this.mediaSource !== mediaSource ||
              this.sourceBuffer !== sourceBuffer
            ) {
              return;
            }
            this.updateLiveEdge();
            this.appendNext();
          });
          sourceBuffer.addEventListener("error", () => {
            if (
              this.mediaSource === mediaSource &&
              this.sourceBuffer === sourceBuffer
            ) {
              this.onResync(
                `mse-source-buffer-error:${this.video.error?.code ?? "unknown"}`,
              );
            }
          });
          this.sourceBuffer = sourceBuffer;
          this.appendNext();
          void this.video.play().catch(() => undefined);
        } catch (error) {
          this.onResync(
            error instanceof Error ? error.message : "mse-initialization",
          );
        }
      },
      { once: true },
    );
    this.startFrameCallbacks();
  }

  appendMedia(segment: MseMediaSegment): void {
    if (!this.mediaSource) {
      return;
    }
    this.sourcePtsOriginUs = segment.sourcePtsOriginUs;
    const queueCostMs = Math.min(
      segment.durationMs,
      Math.max(1, segment.samples.length) * nominalFrameDurationMs,
    );
    this.queuedMediaMs += queueCostMs;
    this.queuedMediaBytes += segment.segment.byteLength;
    if (
      this.queuedMediaMs > maximumAppendQueueMs ||
      this.queuedMediaBytes > maximumAppendQueueBytes
    ) {
      const overflowMs = Math.round(this.queuedMediaMs);
      this.queue.length = 0;
      this.queuedMediaMs = 0;
      this.queuedMediaBytes = 0;
      this.onResync(`mse-append-queue-overflow:${overflowMs}ms`);
      return;
    }
    this.markers.push(
      ...segment.samples.map((sample) => ({
        mediaTime:
          Math.max(0, sample.timestampUs - segment.sourcePtsOriginUs) / 1e6,
        sequence: sample.sequence,
      })),
    );
    if (this.markers.length > 600) {
      this.markers = this.markers.slice(-600);
    }
    this.highestDecodedSequence =
      segment.samples.at(-1)?.sequence ?? this.highestDecodedSequence;
    this.queue.push({
      data: segment.segment,
      queueCostMs,
      media: true,
    });
    this.appendNext();
  }

  snapshot(sourceActive: boolean): MseMetricsSnapshot {
    const now = performance.now();
    const elapsedSeconds = Math.max((now - this.lastMetricsAt) / 1_000, 0.001);
    const quality = this.video.getVideoPlaybackQuality?.();
    const decodedFrames = quality?.totalVideoFrames;
    const droppedFrames = quality?.droppedVideoFrames ?? 0;
    const decodedFps =
      decodedFrames === undefined
        ? undefined
        : (decodedFrames - this.lastReportedDecodedFrames) / elapsedSeconds;
    const presentedFps =
      (this.presentedFrames - this.lastReportedPresentedFrames) /
      elapsedSeconds;
    const droppedDelta = Math.max(
      0,
      droppedFrames - this.lastReportedDroppedFrames,
    );
    const gaps = this.frameGapsMs;
    const gapP95 = percentile(gaps, 0.95);
    if (droppedDelta > 0 || (gapP95 !== undefined && gapP95 > 40)) {
      this.stableSamples = 0;
      this.targetMs = Math.min(maximumTargetMs, this.targetMs + 10);
    } else if (gapP95 !== undefined && gapP95 <= 25) {
      this.stableSamples += 1;
      if (this.stableSamples >= 10) {
        this.targetMs = Math.max(minimumTargetMs, this.targetMs - 10);
        this.stableSamples = 0;
      }
    } else {
      this.stableSamples = 0;
    }
    if (
      sourceActive &&
      this.lastPresentedAt !== null &&
      now - this.lastPresentedAt > 100
    ) {
      if (!this.freezeActive) {
        this.freezeActive = true;
        this.freezeCount += 1;
      }
    } else {
      this.freezeActive = false;
    }
    const snapshot: MseMetricsSnapshot = {
      decodedFps,
      drawnFps: presentedFps,
      presentedFps,
      frameGapP50Ms: percentile(gaps, 0.5),
      frameGapP95Ms: gapP95,
      frameGapP99Ms: percentile(gaps, 0.99),
      frameGapMaxMs: gaps.length > 0 ? Math.max(...gaps) : undefined,
      mseBufferedLeadMs: this.bufferedLeadMs,
      jitterBufferTargetMs: this.targetMs,
      presentationDroppedFrames: droppedFrames,
      freezeCount: this.freezeCount,
      highestDecodedSequence: this.highestDecodedSequence,
      highestPresentedSequence: this.highestPresentedSequence,
      highestPresentedTimestampUs: this.highestPresentedTimestampUs,
    };
    this.lastReportedDecodedFrames = decodedFrames ?? 0;
    this.lastReportedDroppedFrames = droppedFrames;
    this.lastReportedPresentedFrames = this.presentedFrames;
    this.lastMetricsAt = now;
    this.frameGapsMs = [];
    return snapshot;
  }

  close(): void {
    this.stopFrameCallbacks();
    this.resetMediaSource();
  }

  private stopFrameCallbacks(): void {
    const callbackApi = this.video as VideoWithFrameCallback;
    if (
      this.frameCallbackHandle !== null &&
      callbackApi.cancelVideoFrameCallback
    ) {
      callbackApi.cancelVideoFrameCallback(this.frameCallbackHandle);
    }
    this.frameCallbackHandle = null;
  }

  private appendNext(): void {
    const sourceBuffer = this.sourceBuffer;
    if (!sourceBuffer || sourceBuffer.updating || this.queue.length === 0) {
      return;
    }
    const batch = [this.queue.shift()!];
    if (batch[0]!.media) {
      let batchBytes = batch[0]!.data.byteLength;
      while (
        this.queue[0]?.media &&
        batchBytes + this.queue[0].data.byteLength <= maximumAppendQueueBytes
      ) {
        const next = this.queue.shift()!;
        batch.push(next);
        batchBytes += next.data.byteLength;
      }
    }
    const mediaSegments = batch.filter((segment) => segment.media);
    this.queuedMediaMs = Math.max(
      0,
      this.queuedMediaMs -
        mediaSegments.reduce((sum, segment) => sum + segment.queueCostMs, 0),
    );
    this.queuedMediaBytes = Math.max(
      0,
      this.queuedMediaBytes -
        mediaSegments.reduce(
          (sum, segment) => sum + segment.data.byteLength,
          0,
        ),
    );
    const data =
      batch.length === 1
        ? batch[0]!.data
        : this.concatenate(batch.map((segment) => segment.data));
    try {
      sourceBuffer.appendBuffer(data);
      if (mediaSegments.length > 0) {
        void this.video.play().catch(() => undefined);
      }
    } catch {
      this.onResync("mse-append-failed");
    }
  }

  private concatenate(buffers: ArrayBuffer[]): ArrayBuffer {
    const byteLength = buffers.reduce(
      (sum, buffer) => sum + buffer.byteLength,
      0,
    );
    const output = new Uint8Array(byteLength);
    let offset = 0;
    for (const buffer of buffers) {
      output.set(new Uint8Array(buffer), offset);
      offset += buffer.byteLength;
    }
    return output.buffer;
  }

  private updateLiveEdge(): void {
    const sourceBuffer = this.sourceBuffer;
    if (!sourceBuffer || sourceBuffer.buffered.length === 0) {
      return;
    }
    const end = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);
    const targetTime = Math.max(
      sourceBuffer.buffered.start(0),
      end - this.targetMs / 1_000,
    );
    this.bufferedLeadMs = Math.max(0, (end - this.video.currentTime) * 1_000);
    if (
      !Number.isFinite(this.video.currentTime) ||
      this.video.currentTime < targetTime - 0.04 ||
      this.video.currentTime > end
    ) {
      this.video.currentTime = targetTime;
      this.bufferedLeadMs = Math.max(0, (end - this.video.currentTime) * 1_000);
    }
    const removeBefore = this.video.currentTime - maximumHistoryMs / 1_000;
    if (
      this.queue.length === 0 &&
      !sourceBuffer.updating &&
      removeBefore > sourceBuffer.buffered.start(0)
    ) {
      try {
        sourceBuffer.remove(0, removeBefore);
      } catch {
        // A subsequent update cycle will retry pruning.
      }
    }
  }

  private startFrameCallbacks(): void {
    const callbackApi = this.video as VideoWithFrameCallback;
    if (
      !callbackApi.requestVideoFrameCallback ||
      this.frameCallbackHandle !== null
    ) {
      return;
    }
    const next = () => {
      this.frameCallbackHandle = callbackApi.requestVideoFrameCallback!(
        (now, metadata) => {
          const mediaTime = metadata.mediaTime ?? this.video.currentTime;
          this.presentedFrames += 1;
          if (this.lastPresentedAt !== null) {
            this.frameGapsMs.push(now - this.lastPresentedAt);
          }
          this.lastPresentedAt = now;
          this.freezeActive = false;
          for (const marker of this.markers) {
            if (marker.mediaTime <= mediaTime + 0.001) {
              this.highestPresentedSequence = marker.sequence;
              this.highestPresentedTimestampUs =
                this.sourcePtsOriginUs + marker.mediaTime * 1e6;
            } else {
              break;
            }
          }
          if (!this.firstFramePresented) {
            this.firstFramePresented = true;
            this.onFirstFrame();
          }
          next();
        },
      );
    };
    next();
  }

  private resetMediaSource(): void {
    this.queue.length = 0;
    this.queuedMediaMs = 0;
    this.queuedMediaBytes = 0;
    const sourceBuffer = this.sourceBuffer;
    this.sourceBuffer = null;
    if (sourceBuffer?.updating) {
      try {
        sourceBuffer.abort();
      } catch {
        // The MediaSource may already be closing.
      }
    }
    if (this.mediaSource?.readyState === "open") {
      try {
        this.mediaSource.endOfStream();
      } catch {
        // A discontinuity intentionally replaces the old MediaSource.
      }
    }
    this.mediaSource = null;
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
