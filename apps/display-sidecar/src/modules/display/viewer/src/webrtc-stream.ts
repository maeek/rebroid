import type {
  ControlChannel,
  PageLifecycle,
  ViewerConfig,
  ViewerUi,
  ViewerEffectiveProfile,
  ViewerRelayMetrics,
} from "./types.js";
import { configuredStreamProfile } from "./config.js";
import { DisplaySizePresentationTracker } from "./display-size-presentation.js";
import { WebrtcIdlePresentation } from "./webrtc-idle-presentation.js";
import type { ViewerPresentation } from "./viewer-presentation.js";
import {
  emitViewerSessionExpired,
  emitViewerSessionReady,
  emitViewerStreamMetrics,
  emitViewerStreamStatus,
} from "./stream-status.js";

type WebrtcStreamOptions = {
  config: ViewerConfig;
  video: HTMLVideoElement;
  controlChannel: ControlChannel;
  ui: ViewerUi;
  lifecycle: PageLifecycle;
  presentation?: ViewerPresentation;
  getRelayMetrics: () => ViewerRelayMetrics | null;
};

type WebrtcAnswer = {
  transport?: string;
  codec?: string;
  sdp?: string;
  iceServers?: string[];
  profileLevelId?: string;
};

type VideoFrameCallbackMetadata = {
  presentedFrames?: number;
  mediaTime?: number;
  rtpTimestamp?: number;
  width?: number;
  height?: number;
};

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: VideoFrameCallbackMetadata) => void,
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

const webrtcMetricsIntervalMs = 1_000;
const webrtcRetryDelaysMs = [300, 750, 1_500] as const;
const iceDisconnectedGraceMs = 5_000;
const minimumJitterBufferTargetMs = 20;
const maximumJitterBufferTargetMs = 40;
const jitterBufferTargetStepMs = 10;

class PermanentWebrtcError extends Error {}
class WebrtcSessionExpiredError extends PermanentWebrtcError {}

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

export function preferH264PacketizationModeOne(
  transceiver: RTCRtpTransceiver,
): void {
  const codecs = RTCRtpReceiver.getCapabilities("video")?.codecs.filter(
    (codec) =>
      codec.mimeType.toLowerCase() === "video/h264" &&
      /(?:^|;)\s*packetization-mode=1(?:;|$)/i.test(codec.sdpFmtpLine ?? ""),
  );
  if (!codecs?.length || !transceiver.setCodecPreferences) {
    return;
  }
  transceiver.setCodecPreferences(codecs);
}

function waitForIceGathering(
  peer: RTCPeerConnection,
  signal: AbortSignal,
): Promise<void> {
  if (peer.iceGatheringState === "complete") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timeout);
      peer.removeEventListener("icegatheringstatechange", checkState);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const checkState = () => {
      if (peer.iceGatheringState === "complete") finish();
    };
    const timeout = window.setTimeout(finish, 1_500);
    peer.addEventListener("icegatheringstatechange", checkState);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });
}

function waitForConnected(
  peer: RTCPeerConnection,
  signal: AbortSignal,
): Promise<void> {
  if (
    peer.connectionState === "connected" ||
    peer.iceConnectionState === "connected" ||
    peer.iceConnectionState === "completed"
  ) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("WebRTC did not connect in time."));
    }, 6_000);
    const cleanup = () => {
      clearTimeout(timeout);
      peer.removeEventListener("connectionstatechange", checkState);
      peer.removeEventListener("iceconnectionstatechange", checkState);
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(signal.reason);
    };
    const checkState = () => {
      if (
        peer.connectionState === "connected" ||
        peer.iceConnectionState === "connected" ||
        peer.iceConnectionState === "completed"
      ) {
        cleanup();
        resolve();
      }
      if (
        peer.connectionState === "failed" ||
        peer.connectionState === "closed" ||
        peer.iceConnectionState === "failed" ||
        peer.iceConnectionState === "closed"
      ) {
        const state =
          peer.connectionState === "failed" || peer.connectionState === "closed"
            ? peer.connectionState
            : peer.iceConnectionState;
        cleanup();
        reject(new Error(`WebRTC connection ${state}.`));
      }
    };
    peer.addEventListener("connectionstatechange", checkState);
    peer.addEventListener("iceconnectionstatechange", checkState);
    signal.addEventListener("abort", onAbort, { once: true });
    checkState();
  });
}

function waitForFirstVideoFrame(
  video: HTMLVideoElement,
  signal: AbortSignal,
): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("WebRTC connected but no video frame arrived."));
    }, 10_000);
    const cleanup = () => {
      clearTimeout(timeout);
      video.removeEventListener("loadeddata", onFrame);
      video.removeEventListener("playing", onFrame);
      video.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
    };
    const onFrame = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        cleanup();
        resolve();
      }
    };
    const onError = () => {
      cleanup();
      reject(new Error("WebRTC video playback failed."));
    };
    const onAbort = () => {
      cleanup();
      reject(signal.reason);
    };
    video.addEventListener("loadeddata", onFrame);
    video.addEventListener("playing", onFrame);
    video.addEventListener("error", onError);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function clearVideo(video: HTMLVideoElement): void {
  const stream = video.srcObject;
  video.pause();
  video.removeAttribute("src");
  video.srcObject = null;
  if (stream instanceof MediaStream) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }
}

function closePeer(
  peer: RTCPeerConnection | null,
  video: HTMLVideoElement,
): void {
  clearVideo(video);
  peer?.close();
}

function videoTracks(video: HTMLVideoElement): MediaStreamTrack[] {
  return video.srcObject instanceof MediaStream
    ? video.srcObject.getVideoTracks()
    : [];
}

function videoFrameCallbackApi(video: HTMLVideoElement) {
  const candidate = video as unknown as VideoWithFrameCallback;
  const request =
    typeof candidate.requestVideoFrameCallback === "function"
      ? candidate.requestVideoFrameCallback.bind(candidate)
      : null;
  const cancel =
    typeof candidate.cancelVideoFrameCallback === "function"
      ? candidate.cancelVideoFrameCallback.bind(candidate)
      : null;
  return { request, cancel };
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
      stalled: this.stalledSamples >= 3,
      idle: false,
    };
  }
}

function waitForTrack(
  connection: RTCPeerConnection,
  video: HTMLVideoElement,
  isAudioAudible: () => boolean,
  jitterController: AdaptiveJitterBufferController,
  signal: AbortSignal,
): Promise<void> {
  const mediaStream = new MediaStream();
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("WebRTC connected but no video track arrived."));
    }, 6000);
    const cleanup = () => {
      clearTimeout(timeout);
      connection.removeEventListener("track", onTrack);
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new Error("WebRTC attempt ended before its video track arrived."));
    };
    const onTrack = (event: RTCTrackEvent) => {
      jitterController.add(event.receiver);
      if (event.track.kind !== "video") {
        if (!event.streams.length) mediaStream.addTrack(event.track);
        return;
      }
      const [stream] = event.streams;
      const previous = video.srcObject;
      if (stream) {
        video.srcObject = stream;
      } else {
        mediaStream.addTrack(event.track);
        video.srcObject = mediaStream;
      }
      if (previous instanceof MediaStream && previous !== video.srcObject) {
        for (const track of previous.getTracks()) track.stop();
      }
      void playVideoWithAutoplayFallback(video, isAudioAudible(), signal);
      cleanup();
      resolve();
    };
    connection.addEventListener("track", onTrack);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function playVideoWithAutoplayFallback(
  video: HTMLVideoElement,
  audioRequested: boolean,
  signal: AbortSignal,
): Promise<void> {
  video.muted = !audioRequested;
  try {
    await video.play();
  } catch {
    if (signal.aborted) return;
    video.muted = true;
    await video.play().catch(() => undefined);
  }
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function metricReportNumber(report: RTCStats, key: string): number | undefined {
  return finiteNumber((report as unknown as Record<string, unknown>)[key]);
}

function isVideoInboundReport(report: RTCStats): boolean {
  const record = report as unknown as Record<string, unknown>;
  return (
    report.type === "inbound-rtp" &&
    record.kind === "video" &&
    record.isRemote !== true
  );
}

function isRoundTripReport(report: RTCStats): boolean {
  const record = report as unknown as Record<string, unknown>;
  return (
    (report.type === "candidate-pair" &&
      (record.selected === true || record.nominated === true)) ||
    report.type === "remote-inbound-rtp"
  );
}

function percentile(values: number[], percentileValue: number) {
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

function startWebrtcMetricsMonitor(
  peer: RTCPeerConnection,
  video: HTMLVideoElement,
  effectiveProfile: ViewerEffectiveProfile,
  getRelayMetrics: () => ViewerRelayMetrics | null,
  consumerGeneration: number,
  getReconnectCount: () => number,
  jitterController: AdaptiveJitterBufferController,
  negotiatedProfileLevelId: string | undefined,
  onStall: () => void,
  reliableChannel: RTCDataChannel,
  displaySizePresentation: DisplaySizePresentationTracker,
): () => void {
  const frameCallback = videoFrameCallbackApi(video);
  let stopped = false;
  let frameCallbackHandle: number | null = null;
  let presentedFrames = 0;
  let lastBytes = 0;
  let lastReceivedFrames = 0;
  let lastDecodedFrames = 0;
  let lastPresentedFrames: number | undefined;
  let lastJitterBufferDelay = 0;
  let lastJitterBufferEmitted = 0;
  let lastDroppedFrames = 0;
  let lastAt = performance.now();
  let lastPresentedAt: number | null = null;
  let frameGapsMs: number[] = [];
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
        frameGapsMs.push(now - lastPresentedAt);
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
    const elapsedSeconds = Math.max((now - lastAt) / 1000, 0.001);
    const statsRequest = peer.getStats().catch(() => null);
    void statsRequest.then((stats) => {
      sampling = false;
      if (stopped || !stats) return;
      let bytes = lastBytes;
      let receivedFrames = lastReceivedFrames;
      let decodedFrames = lastDecodedFrames;
      let droppedFrames: number | undefined;
      let packetsLost: number | undefined;
      let nackCount: number | undefined;
      let pliCount: number | undefined;
      let jitterBufferDelay = lastJitterBufferDelay;
      let jitterBufferEmitted = lastJitterBufferEmitted;
      let roundTripTimeMs: number | undefined;
      let networkJitterMs: number | undefined;

      stats.forEach((report) => {
        if (isVideoInboundReport(report)) {
          bytes = metricReportNumber(report, "bytesReceived") ?? bytes;
          receivedFrames =
            metricReportNumber(report, "framesReceived") ?? receivedFrames;
          decodedFrames =
            metricReportNumber(report, "framesDecoded") ?? decodedFrames;
          droppedFrames = metricReportNumber(report, "framesDropped");
          packetsLost = metricReportNumber(report, "packetsLost");
          nackCount = metricReportNumber(report, "nackCount");
          pliCount = metricReportNumber(report, "pliCount");
          const jitterSeconds = metricReportNumber(report, "jitter");
          networkJitterMs =
            jitterSeconds === undefined ? undefined : jitterSeconds * 1_000;
          jitterBufferDelay =
            metricReportNumber(report, "jitterBufferDelay") ??
            jitterBufferDelay;
          jitterBufferEmitted =
            metricReportNumber(report, "jitterBufferEmittedCount") ??
            jitterBufferEmitted;
        }
        if (isRoundTripReport(report)) {
          const seconds =
            metricReportNumber(report, "currentRoundTripTime") ??
            metricReportNumber(report, "roundTripTime");
          if (seconds !== undefined) {
            roundTripTimeMs = seconds * 1000;
          }
        }
      });

      const jitterDelayDelta = jitterBufferDelay - lastJitterBufferDelay;
      const jitterEmittedDelta = jitterBufferEmitted - lastJitterBufferEmitted;
      const jitterQueueDepthMs =
        jitterEmittedDelta > 0
          ? (jitterDelayDelta / jitterEmittedDelta) * 1_000
          : undefined;
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
      const presentedFps =
        presentedFrameCount === undefined || lastPresentedFrames === undefined
          ? undefined
          : (presentedFrameCount - lastPresentedFrames) / elapsedSeconds;
      const presentation = progress.sample(
        relayMetrics,
        presentedFrameCount,
        receivedFrames,
        decodedFrames,
        !document.hidden,
      );
      sourceActive = !presentation.idle;
      if (presentation.idle) lastPresentedAt = null;
      if (presentation.freeze) freezeCount += 1;

      const gaps = frameGapsMs;
      const frameGapP95Ms = percentile(gaps, 0.95);
      const currentDroppedFrames = droppedFrames ?? lastDroppedFrames;
      jitterController.sample(
        frameGapP95Ms,
        Math.max(0, currentDroppedFrames - lastDroppedFrames),
      );

      emitViewerStreamMetrics({
        version: 4,
        transport: "webrtc",
        displaySizePresentation: displaySizePresentation.snapshot(),
        sourceFps: relayMetrics?.sourceFps,
        relayIngressFps: relayMetrics?.sourceFps,
        bridgeInputFps: relayMetrics?.bridgeInputFps,
        rtpSentFps: relayMetrics?.rtpSentFps,
        receivedFps: (receivedFrames - lastReceivedFrames) / elapsedSeconds,
        receivedFrames,
        decodedFrames,
        presentedFrames: presentedFrameCount,
        receiverPacketsLost: packetsLost,
        receiverNackCount: nackCount,
        receiverPliCount: pliCount,
        frameAcknowledgement: frameCallback.request
          ? frameAcknowledgement.status
          : "callback-unavailable",
        frameAcknowledgementsSent: frameAcknowledgement.sentCount,
        consumerAttemptId: relayMetrics?.consumerAttemptId,
        sourceCodecGeneration: relayMetrics?.sourceCodecGeneration,
        videoResetGeneration: relayMetrics?.videoResetGeneration,
        videoResetCompletedGeneration:
          relayMetrics?.videoResetCompletedGeneration,
        videoResetElapsedMs: relayMetrics?.videoResetElapsedMs,
        videoResetCount: relayMetrics?.videoResetCount,
        decodedFps: (decodedFrames - lastDecodedFrames) / elapsedSeconds,
        drawnFps: presentedFps,
        presentedFps,
        wireBitrateMbps: ((bytes - lastBytes) * 8) / elapsedSeconds / 1_000_000,
        sourceBitrateMbps: relayMetrics?.sourceBitrateMbps,
        sourceFrameSizeP95Bytes: relayMetrics?.sourceFrameSizeP95Bytes,
        keyFrameSizeBytes: relayMetrics?.keyFrameSizeBytes,
        sourceInterFrameP95Ms: relayMetrics?.sourceInterFrameP95Ms,
        networkInterArrivalJitterP95Ms: networkJitterMs,
        frameGapP50Ms: percentile(gaps, 0.5),
        frameGapP95Ms,
        frameGapP99Ms: percentile(gaps, 0.99),
        frameGapMaxMs: gaps.length > 0 ? Math.max(...gaps) : undefined,
        relayQueueDepthMs: relayMetrics?.queueDepthMs,
        relayP95Ms: relayMetrics?.relayP95Ms,
        relayP99Ms: relayMetrics?.relayP99Ms,
        rtpPacketizationP95Ms: relayMetrics?.rtpPacketizationP95Ms,
        rtpWriteP95Ms: relayMetrics?.rtpWriteP95Ms,
        rtpSendErrors: relayMetrics?.rtpSendErrors,
        eventLoopUtilization: relayMetrics?.eventLoopUtilization,
        gcPauseP95Ms: relayMetrics?.gcPauseP95Ms,
        decoderQueueDepth: 0,
        pendingRenderFrames: 0,
        webrtcJitterBufferDepthMs: jitterQueueDepthMs,
        jitterBufferTargetMs: jitterController.target(),
        relayDroppedFrames: relayMetrics?.droppedFrames ?? 0,
        decodeDroppedFrames: droppedFrames ?? 0,
        presentationDroppedFrames: 0,
        freezeCount,
        reconnectCount: getReconnectCount(),
        roundTripTimeMs: roundTripTimeMs ?? relayMetrics?.bridgeRoundTripTimeMs,
        packetsLost: packetsLost ?? relayMetrics?.bridgePacketsLost,
        nackCount: relayMetrics?.bridgeNackCount ?? nackCount,
        pliCount: relayMetrics?.bridgePliCount ?? pliCount,
        retransmittedPackets: relayMetrics?.retransmittedPackets,
        retransmittedBytes: relayMetrics?.retransmittedBytes,
        packetsDiscardedOnSend: relayMetrics?.packetsDiscardedOnSend,
        rtpSendDelayMs: relayMetrics?.rtpSendDelayMs,
        mainThreadLongTaskCount,
        width: video.videoWidth || undefined,
        height: video.videoHeight || undefined,
        renderer: "webrtc-video",
        decoderPreference: "native",
        h264ProfileLevelId: relayMetrics?.h264ProfileLevelId,
        negotiatedH264ProfileLevelId: negotiatedProfileLevelId,
        sourceAttemptId: relayMetrics?.sourceAttemptId,
        consumerGeneration,
        effectiveProfile: {
          ...effectiveProfile,
          actualEncoder: relayMetrics?.actualEncoder,
          width: relayMetrics?.width,
          height: relayMetrics?.height,
          pixelRate:
            relayMetrics?.width && relayMetrics.height
              ? relayMetrics.width *
                relayMetrics.height *
                effectiveProfile.maxFps
              : undefined,
          h264ProfileLevelId: relayMetrics?.h264ProfileLevelId,
          negotiatedH264ProfileLevelId: negotiatedProfileLevelId,
          sourceAttemptId: relayMetrics?.sourceAttemptId,
        },
        collectedAt: Date.now(),
      });

      lastBytes = bytes;
      lastReceivedFrames = receivedFrames;
      lastDecodedFrames = decodedFrames;
      lastPresentedFrames = presentedFrameCount;
      lastJitterBufferDelay = jitterBufferDelay;
      lastJitterBufferEmitted = jitterBufferEmitted;
      lastDroppedFrames = currentDroppedFrames;
      lastAt = now;
      frameGapsMs = [];
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

export function createWebrtcStream({
  config,
  video,
  controlChannel,
  ui,
  lifecycle,
  presentation,
  getRelayMetrics,
}: WebrtcStreamOptions) {
  const viewerId = Array.from(
    crypto.getRandomValues(new Uint8Array(16)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  const displaySizePresentation = new DisplaySizePresentationTracker();
  let stopSizeObservation: (() => void) | null = null;
  let peer: RTCPeerConnection | null = null;
  let terminalFailure = false;
  let stopMetricsMonitor: (() => void) | null = null;
  let stopConnectionMonitor: (() => void) | null = null;
  let retryTimer = 0;
  let retriesUsed = 0;
  let reconnectCount = 0;
  let peerGeneration = 0;
  let attemptAbort: AbortController | null = null;
  let consumerAttemptId: string | undefined;
  let heldPicture = false;
  let started = false;
  let hadDemand = lifecycle.hasDemand();
  const isAudioAudible = () => config.audio && !presentation?.isCompact();
  const stopWatchingPresentation = presentation?.onChange(() => {
    const audible = isAudioAudible();
    const signal = attemptAbort?.signal;
    if (audible && signal && video.srcObject) {
      void playVideoWithAutoplayFallback(video, audible, signal);
    } else {
      video.muted = !audible;
    }
  });

  const clearRetry = () => {
    if (!retryTimer) return;
    window.clearTimeout(retryTimer);
    retryTimer = 0;
  };

  const retireAttempt = () => {
    attemptAbort?.abort();
    attemptAbort = null;
    stopSizeObservation?.();
    stopSizeObservation = null;
    stopMetricsMonitor?.();
    stopMetricsMonitor = null;
    stopConnectionMonitor?.();
    stopConnectionMonitor = null;
    const retiringPeer = peer;
    peer = null;
    return retiringPeer;
  };

  const observeDisplaySize = (
    connection: RTCPeerConnection,
    generation: number,
    trackReady: Promise<void>,
  ) => {
    const { request, cancel } = videoFrameCallbackApi(video);
    if (!request) return;
    let handle: number | undefined;
    let active = true;
    const isCurrent = () =>
      active &&
      peer === connection &&
      peerGeneration === generation &&
      lifecycle.hasDemand() &&
      !lifecycle.isClosing();
    stopSizeObservation = () => {
      active = false;
      if (handle !== undefined) cancel?.(handle);
    };
    const observe = () => {
      if (!isCurrent()) return;
      handle = request((at, metadata) => {
        if (!isCurrent()) return;
        const accepted = displaySizePresentation.present(
          {
            width: metadata.width ?? video.videoWidth,
            height: metadata.height ?? video.videoHeight,
          },
          at,
        );
        if (!accepted) observe();
      });
    };
    void trackReady.then(observe, () => undefined);
  };

  video.addEventListener(
    "pointerdown",
    () => {
      if (!lifecycle.hasDemand()) return;
      if (isAudioAudible()) {
        video.muted = false;
      }
      void video.play().catch(() => undefined);
    },
    { passive: true },
  );

  const failPermanently = (
    reason: string,
    sessionExpired = false,
    failureStage?: string,
  ) => {
    if (terminalFailure || lifecycle.isClosing() || !lifecycle.hasDemand()) {
      return;
    }
    terminalFailure = true;
    clearRetry();
    if (sessionExpired) {
      emitViewerSessionExpired("webrtc", config.sessionId);
    } else {
      emitViewerStreamStatus({
        code: "stream-error",
        severity: "error",
        blocking: true,
        message: reason,
        sessionId: config.sessionId,
        consumerAttemptId,
        failureStage,
        transport: "webrtc",
      });
    }
    closePeer(retireAttempt(), video);
    ui.showFailure(reason);
  };

  const unsubscribeDemand = lifecycle.onDemandChange((active) => {
    if (active === hadDemand) return;
    hadDemand = active;
    if (!started || terminalFailure || lifecycle.isClosing()) return;
    if (active) {
      displaySizePresentation.beginRecovery(performance.now());
      void connectAttempt().catch(() => retryOrFail("WebRTC resume failed."));
      return;
    }
    clearRetry();
    retriesUsed = 0;
    displaySizePresentation.cancelPending();
    if (peer && !heldPicture) heldPicture = ui.preserveVideoFrame(video);
    closePeer(retireAttempt(), video);
  });

  lifecycle.onClose(() => {
    unsubscribeDemand();
    stopWatchingPresentation?.();
    clearRetry();
    closePeer(retireAttempt(), video);
  });

  const retryOrFail = (reason: string, failureStage = "peer-recovery") => {
    if (
      !started ||
      terminalFailure ||
      lifecycle.isClosing() ||
      !lifecycle.hasDemand() ||
      retryTimer
    ) {
      return;
    }
    displaySizePresentation.beginRecovery(performance.now());
    reconnectCount += 1;
    if (!heldPicture) heldPicture = ui.preserveVideoFrame(video);
    retireAttempt()?.close();
    if (retriesUsed >= webrtcRetryDelaysMs.length) {
      console.warn("WebRTC recovery exhausted.", reason);
      failPermanently(
        `WebRTC stopped after ${webrtcRetryDelaysMs.length} recovery attempts: ${reason}`,
        false,
        failureStage,
      );
      return;
    }
    const delayMs = webrtcRetryDelaysMs[retriesUsed]!;
    retriesUsed += 1;
    emitViewerStreamStatus({
      code: "reconnecting",
      severity: "info",
      blocking: false,
      message: reason,
      sessionId: config.sessionId,
      consumerAttemptId,
      failureStage,
      transport: "webrtc",
    });
    retryTimer = window.setTimeout(() => {
      retryTimer = 0;
      void connectAttempt();
    }, delayMs);
  };

  const monitorConnection = (
    connection: RTCPeerConnection,
    currentGeneration: number,
  ) => {
    let disconnectedTimer = 0;
    const clearDisconnectedTimer = () => {
      if (disconnectedTimer) {
        window.clearTimeout(disconnectedTimer);
        disconnectedTimer = 0;
      }
    };
    const check = () => {
      if (peer !== connection || peerGeneration !== currentGeneration) {
        clearDisconnectedTimer();
        return;
      }
      if (
        connection.connectionState === "failed" ||
        connection.connectionState === "closed" ||
        connection.iceConnectionState === "failed" ||
        connection.iceConnectionState === "closed"
      ) {
        clearDisconnectedTimer();
        retryOrFail(
          `WebRTC connection ${connection.connectionState}/${connection.iceConnectionState}.`,
        );
        return;
      }
      if (connection.iceConnectionState === "disconnected") {
        if (!disconnectedTimer) {
          disconnectedTimer = window.setTimeout(() => {
            disconnectedTimer = 0;
            if (
              peer === connection &&
              connection.iceConnectionState === "disconnected"
            ) {
              retryOrFail("WebRTC ICE remained disconnected for 5 seconds.");
            }
          }, iceDisconnectedGraceMs);
        }
        return;
      }
      clearDisconnectedTimer();
    };
    connection.addEventListener("connectionstatechange", check);
    connection.addEventListener("iceconnectionstatechange", check);
    return () => {
      clearDisconnectedTimer();
      connection.removeEventListener("connectionstatechange", check);
      connection.removeEventListener("iceconnectionstatechange", check);
    };
  };

  async function connectAttempt(): Promise<void> {
    if (
      lifecycle.isClosing() ||
      !lifecycle.hasDemand() ||
      terminalFailure ||
      peer
    )
      return;
    if (!config.sessionId) {
      failPermanently("Open the viewer again from the app page.");
      return;
    }
    if (!("RTCPeerConnection" in window)) {
      failPermanently("This browser does not support WebRTC playback.");
      return;
    }

    if (!heldPicture) {
      ui.showStatus(
        "Starting WebRTC...",
        "Starting live display",
        "Rebroid is opening the app screen.",
      );
    }
    const currentGeneration = ++peerGeneration;
    consumerAttemptId = undefined;
    let failureStage = "signaling";
    const connection = new RTCPeerConnection();
    const jitterController = new AdaptiveJitterBufferController();
    const controller = new AbortController();
    const { signal } = controller;
    attemptAbort = controller;
    peer = connection;
    const isCurrent = () =>
      !signal.aborted &&
      lifecycle.hasDemand() &&
      !lifecycle.isClosing() &&
      peer === connection &&
      peerGeneration === currentGeneration;
    const recoverCurrent = (reason: string, stage = failureStage) => {
      if (isCurrent()) retryOrFail(reason, stage);
    };
    stopConnectionMonitor = monitorConnection(connection, currentGeneration);
    const reliableChannel = connection.createDataChannel("rebroid-control", {
      ordered: true,
    });
    const movementChannel = connection.createDataChannel("rebroid-pointer", {
      ordered: false,
      maxRetransmits: 0,
    });
    reliableChannel.addEventListener(
      "close",
      () => {
        recoverCurrent("WebRTC control channel closed.", "control-channel");
      },
      { once: true, signal },
    );
    controlChannel.useDataChannels(reliableChannel, movementChannel, () =>
      recoverCurrent("WebRTC video codec configuration changed."),
    );
    const videoTransceiver = connection.addTransceiver("video", {
      direction: "recvonly",
    });
    preferH264PacketizationModeOne(videoTransceiver);
    if (config.audio) {
      connection.addTransceiver("audio", { direction: "recvonly" });
    }
    video.muted = !isAudioAudible();

    try {
      const offer = await connection.createOffer();
      signal.throwIfAborted();
      await connection.setLocalDescription(offer);
      await waitForIceGathering(connection, signal);
      signal.throwIfAborted();
      const trackReady = waitForTrack(
        connection,
        video,
        isAudioAudible,
        jitterController,
        signal,
      );
      // Signaling can fail before the track wait is consumed.
      void trackReady.catch(() => undefined);
      observeDisplaySize(connection, currentGeneration, trackReady);

      const offerAt = performance.timeOrigin + performance.now();
      const response = await fetch(
        `/rebroid/display/public/sessions/${encodeURIComponent(config.sessionId)}/webrtc/offer`,
        {
          method: "POST",
          signal,
          headers: {
            "content-type": "application/json",
            "x-rebroid-viewer-id": viewerId,
          },
          body: JSON.stringify({
            sdp: connection.localDescription?.sdp ?? offer.sdp,
            bitrate: Number(
              config.params.get("bitrate") ?? config.streamDefaults.bitrate,
            ),
            maxFps: Number(
              config.params.get("maxFps") ?? config.streamDefaults.maxFps,
            ),
            maxSize: Number(
              config.params.get("maxSize") ?? config.streamDefaults.maxSize,
            ),
            iFrameInterval: Number(
              config.params.get("iFrameInterval") ??
                config.streamDefaults.iFrameInterval,
            ),
            audio: config.audio,
          }),
        },
      );
      if (!response.ok) {
        let detail = `WebRTC offer failed: ${response.status}`;
        let code: unknown;
        try {
          const payload = (await response.json()) as {
            code?: unknown;
            message?: unknown;
          };
          if (typeof payload.message === "string") {
            detail = payload.message;
          }
          if (typeof payload.code === "string") {
            code = payload.code;
            detail = `${payload.code}: ${detail}`;
          }
        } catch {
          // Keep the bounded HTTP status diagnostic.
        }
        if (response.status === 409 && code === "feature_disabled") {
          if (isCurrent()) {
            const url = new URL(location.href);
            url.searchParams.set("transport", "websocket");
            location.replace(url.href);
          } else {
            connection.close();
          }
          return;
        }
        if (response.status === 404 && code === "display_session_unavailable") {
          throw new WebrtcSessionExpiredError(detail);
        }
        if (
          response.status >= 400 &&
          response.status < 500 &&
          code !== "display_profile_in_use"
        ) {
          throw new PermanentWebrtcError(detail);
        }
        throw new Error(detail);
      }
      const attemptId = response.headers?.get("x-rebroid-webrtc-attempt");
      const answer = (await response.json()) as WebrtcAnswer;
      if (!answer.sdp) {
        throw new Error("WebRTC answer was missing SDP.");
      }
      signal.throwIfAborted();
      if (attemptId && /^[a-z0-9-]{1,64}$/i.test(attemptId))
        consumerAttemptId = attemptId;
      failureStage = "connection";
      await connection.setRemoteDescription({
        type: "answer",
        sdp: answer.sdp,
      });
      await waitForConnected(connection, signal);
      failureStage = "first-frame";
      await trackReady;
      await waitForFirstVideoFrame(video, signal);
      if (!isCurrent()) {
        connection.close();
        return;
      }
      heldPicture = false;
      failureStage = "playback";
      ui.showVideo();
      emitViewerSessionReady("webrtc", config.sessionId, offerAt);
      retriesUsed = 0;
      stopSizeObservation?.();
      stopSizeObservation = null;
      stopMetricsMonitor?.();
      stopMetricsMonitor = startWebrtcMetricsMonitor(
        connection,
        video,
        configuredStreamProfile(config, "webrtc"),
        getRelayMetrics,
        currentGeneration,
        () => reconnectCount,
        jitterController,
        answer.profileLevelId,
        () => recoverCurrent("WebRTC video stopped presenting frames."),
        reliableChannel,
        displaySizePresentation,
      );
    } catch (error) {
      if (isCurrent()) {
        const reason =
          error instanceof Error ? error.message : "WebRTC recovery failed.";
        if (error instanceof PermanentWebrtcError) {
          failPermanently(
            reason,
            error instanceof WebrtcSessionExpiredError,
            failureStage,
          );
        } else {
          retryOrFail(reason, failureStage);
        }
      } else if (connection.connectionState !== "closed") {
        connection.close();
      }
    }
  }

  async function connect(): Promise<void> {
    if (started) return;
    started = true;
    await connectAttempt();
  }

  return {
    connect,
    scheduleReconnect() {
      retryOrFail("WebRTC reconnection requested.");
    },
  };
}
