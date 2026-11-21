import type { ViewerEffectiveProfile } from "@rebroid/android-application-core/viewer-stream";
import type { DisplaySizePresentationTracker } from "./display-size-presentation.js";
import { emitViewerStreamMetrics } from "./stream-status.js";
import type { ViewerRelayMetrics } from "./types.js";
import { WebrtcIdlePresentation } from "./webrtc-idle-presentation.js";
import {
  buildWebrtcMetricsReport,
  calculateWebrtcIntervalMetrics,
  readWebrtcReceiverStats,
  WebrtcFrameGapSamples,
  type WebrtcIntervalSample,
} from "./webrtc-receiver-metrics.js";

const webrtcMetricsIntervalMs = 1_000;
const minimumJitterBufferTargetMs = 20;
const maximumJitterBufferTargetMs = 40;
const jitterBufferTargetStepMs = 10;

export function videoFrameCallbackApi(video: HTMLVideoElement) {
  const request =
    typeof video.requestVideoFrameCallback === "function"
      ? video.requestVideoFrameCallback.bind(video)
      : null;
  const cancel =
    typeof video.cancelVideoFrameCallback === "function"
      ? video.cancelVideoFrameCallback.bind(video)
      : null;
  return { request, cancel };
}

export class AdaptiveJitterBufferController {
  private readonly receivers = new Set<
    RTCRtpReceiver & { jitterBufferTarget?: number }
  >();
  private stableSamples = 0;
  private targetMs = minimumJitterBufferTargetMs;

  add(receiver: RTCRtpReceiver): void {
    const controlled = receiver as RTCRtpReceiver & {
      jitterBufferTarget?: number;
    };
    this.receivers.add(controlled);
    this.apply(controlled);
  }

  sample(frameGapP95Ms: number | undefined, droppedFrames: number): void {
    if (
      droppedFrames > 0 ||
      (frameGapP95Ms !== undefined && frameGapP95Ms > 40)
    ) {
      this.stableSamples = 0;
      this.setTarget(
        Math.min(
          maximumJitterBufferTargetMs,
          this.targetMs + jitterBufferTargetStepMs,
        ),
      );
      return;
    }
    if (frameGapP95Ms === undefined || frameGapP95Ms > 25) {
      this.stableSamples = 0;
      return;
    }
    this.stableSamples += 1;
    if (this.stableSamples >= 10) {
      this.stableSamples = 0;
      this.setTarget(
        Math.max(
          minimumJitterBufferTargetMs,
          this.targetMs - jitterBufferTargetStepMs,
        ),
      );
    }
  }

  target(): number {
    return this.targetMs;
  }

  private setTarget(targetMs: number): void {
    if (targetMs === this.targetMs) {
      return;
    }
    this.targetMs = targetMs;
    for (const receiver of this.receivers) {
      this.apply(receiver);
    }
  }

  private apply(
    receiver: RTCRtpReceiver & { jitterBufferTarget?: number },
  ): void {
    if (!("jitterBufferTarget" in receiver)) {
      return;
    }
    try {
      receiver.jitterBufferTarget = this.targetMs;
    } catch {
      this.receivers.delete(receiver);
    }
  }
}

export class WebrtcPresentationProgress {
  private sampled = false;
  private source: ViewerRelayMetrics | null = null;
  private presentedFrames: number | undefined;
  private receivedFrames = 0;
  private decodedFrames = 0;
  private stalledSamples = 0;

  sample(
    source: ViewerRelayMetrics | null,
    presentedFrames: number | undefined,
    receivedFrames: number,
    decodedFrames: number,
    visible: boolean,
    waitingForVideoReset = false,
  ) {
    const previousSource = this.source;
    const freshSource = source !== null && source !== previousSource;
    const decodedAdvanced = decodedFrames > this.decodedFrames;
    const inputAdvanced =
      (freshSource &&
        (source.sourceVideoFrames ?? 0) >
          (previousSource?.sourceVideoFrames ?? 0)) ||
      receivedFrames > this.receivedFrames ||
      decodedAdvanced;
    // Without presentation counters we can still detect an upstream stall.
    const outputAdvanced =
      presentedFrames === undefined
        ? decodedAdvanced
        : presentedFrames > (this.presentedFrames ?? 0);
    this.source = source;
    this.presentedFrames = presentedFrames;
    this.receivedFrames = receivedFrames;
    this.decodedFrames = decodedFrames;

    if (!this.sampled) {
      this.sampled = true;
      return { freeze: false, stalled: false, idle: true };
    }
    if (!visible || outputAdvanced || !inputAdvanced) {
      this.stalledSamples = 0;
      return {
        freeze: false,
        stalled: false,
        idle: !visible || (!inputAdvanced && !outputAdvanced),
      };
    }
    this.stalledSamples += 1;
    return {
      freeze: presentedFrames !== undefined && this.stalledSamples === 2,
      stalled: this.stalledSamples >= 3 && !waitingForVideoReset,
      idle: false,
    };
  }
}

function videoTracks(video: HTMLVideoElement): MediaStreamTrack[] {
  return video.srcObject instanceof MediaStream
    ? video.srcObject.getVideoTracks()
    : [];
}

type WebrtcMetricsMonitorOptions = {
  peer: RTCPeerConnection;
  video: HTMLVideoElement;
  effectiveProfile: ViewerEffectiveProfile;
  getRelayMetrics: () => ViewerRelayMetrics | null;
  consumerGeneration: number;
  getReconnectCount: () => number;
  jitterController: AdaptiveJitterBufferController;
  negotiatedProfileLevelId?: string;
  onStall: () => void;
  waitingForVideoReset: () => boolean;
  reliableChannel: RTCDataChannel;
  displaySizePresentation: DisplaySizePresentationTracker;
};

export function startWebrtcMetricsMonitor({
  peer,
  video,
  effectiveProfile,
  getRelayMetrics,
  consumerGeneration,
  getReconnectCount,
  jitterController,
  negotiatedProfileLevelId,
  onStall,
  waitingForVideoReset,
  reliableChannel,
  displaySizePresentation,
}: WebrtcMetricsMonitorOptions): () => void {
  const frameCallback = videoFrameCallbackApi(video);
  let stopped = false;
  let frameCallbackHandle: number | null = null;
  let presentedFrames = 0;
  let previousSample: WebrtcIntervalSample = {
    receiver: {
      bytesReceived: 0,
      framesReceived: 0,
      framesDecoded: 0,
      jitterBufferDelay: 0,
      jitterBufferEmittedCount: 0,
    },
    droppedFrames: 0,
    sampledAt: performance.now(),
  };
  let lastPresentedAt: number | null = null;
  const frameGaps = new WebrtcFrameGapSamples();
  let freezeCount = 0;
  let sampling = false;
  let sourceActive = false;
  const progress = new WebrtcPresentationProgress();
  const idlePresentation = new WebrtcIdlePresentation();
  const tracks = videoTracks(video);
  for (const track of tracks) track.addEventListener("ended", onStall);
  let mainThreadLongTaskCount = 0;
  const longTaskObserver =
    "PerformanceObserver" in window
      ? new PerformanceObserver((entries) => {
          mainThreadLongTaskCount += entries.getEntries().length;
        })
      : null;
  try {
    longTaskObserver?.observe({ type: "longtask", buffered: true });
  } catch {
    longTaskObserver?.disconnect();
  }

  const requestNextFrame = () => {
    if (stopped || !frameCallback.request) {
      return;
    }
    frameCallbackHandle = frameCallback.request((at, metadata) => {
      if (stopped) return;
      displaySizePresentation.present(
        {
          width: metadata.width ?? video.videoWidth,
          height: metadata.height ?? video.videoHeight,
        },
        at,
      );
      const now = performance.now();
      idlePresentation.presented(metadata.rtpTimestamp, now);
      if (lastPresentedAt !== null && sourceActive && !document.hidden) {
        frameGaps.add(now - lastPresentedAt);
      }
      lastPresentedAt = now;
      presentedFrames += 1;
      requestNextFrame();
    });
  };

  requestNextFrame();

  const timer = window.setInterval(() => {
    if (sampling || stopped) return;
    sampling = true;
    const now = performance.now();
    idlePresentation.sample(reliableChannel, now);
    const frameAcknowledgement = idlePresentation.diagnostics();
    const statsRequest = peer.getStats().catch(() => null);
    void statsRequest.then((stats) => {
      sampling = false;
      if (stopped || !stats) return;
      const receiverStats = readWebrtcReceiverStats(
        stats,
        previousSample.receiver,
      );
      const { receiver, droppedFrames } = receiverStats;
      const { framesReceived: receivedFrames, framesDecoded: decodedFrames } =
        receiver;
      const relayMetrics = getRelayMetrics();
      const quality = frameCallback.request
        ? undefined
        : video.getVideoPlaybackQuality?.();
      let presentedFrameCount = frameCallback.request
        ? presentedFrames
        : undefined;
      if (quality) {
        presentedFrameCount =
          quality.totalVideoFrames - quality.droppedVideoFrames;
      }
      const currentSample: WebrtcIntervalSample = {
        receiver,
        presentedFrames: presentedFrameCount,
        droppedFrames: droppedFrames ?? previousSample.droppedFrames,
        sampledAt: now,
      };
      const intervalMetrics = calculateWebrtcIntervalMetrics(
        previousSample,
        currentSample,
      );
      const presentation = progress.sample(
        relayMetrics,
        presentedFrameCount,
        receivedFrames,
        decodedFrames,
        !document.hidden,
        waitingForVideoReset(),
      );
      sourceActive = !presentation.idle;
      if (presentation.idle) lastPresentedAt = null;
      if (presentation.freeze) freezeCount += 1;

      const gapMetrics = frameGaps.takeSummary();
      jitterController.sample(
        gapMetrics.frameGapP95Ms,
        intervalMetrics.droppedFramesDelta,
      );

      emitViewerStreamMetrics(
        buildWebrtcMetricsReport({
          displaySizePresentation: displaySizePresentation.snapshot(),
          receiverStats,
          intervalMetrics,
          gapMetrics,
          relayMetrics,
          effectiveProfile,
          presentedFrames: presentedFrameCount,
          frameAcknowledgement: frameCallback.request
            ? frameAcknowledgement.status
            : "callback-unavailable",
          frameAcknowledgementsSent: frameAcknowledgement.sentCount,
          jitterBufferTargetMs: jitterController.target(),
          freezeCount,
          reconnectCount: getReconnectCount(),
          mainThreadLongTaskCount,
          width: video.videoWidth || undefined,
          height: video.videoHeight || undefined,
          consumerGeneration,
          negotiatedProfileLevelId,
          collectedAt: Date.now(),
        }),
      );

      previousSample = currentSample;
      if (presentation.stalled) onStall();
    });
  }, webrtcMetricsIntervalMs);

  return () => {
    stopped = true;
    window.clearInterval(timer);
    if (frameCallbackHandle !== null && frameCallback.cancel) {
      frameCallback.cancel(frameCallbackHandle);
    }
    longTaskObserver?.disconnect();
    for (const track of tracks) track.removeEventListener("ended", onStall);
  };
}
