import type {
  ControlChannel,
  PageLifecycle,
  ViewerConfig,
  ViewerUi,
  ViewerEffectiveProfile,
  ViewerRelayMetrics,
} from "./types.js";
import { configuredStreamProfile } from "./config.js";
import { WebrtcIdlePresentation } from "./webrtc-idle-presentation.js";
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

function waitForIceGathering(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === "complete") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    peer.addEventListener(
      "icegatheringstatechange",
      () => {
        if (peer.iceGatheringState === "complete") {
          resolve();
        }
      },
      { once: false },
    );
    window.setTimeout(resolve, 1500);
  });
}

function waitForConnected(peer: RTCPeerConnection): Promise<void> {
  if (
    peer.connectionState === "connected" ||
    peer.iceConnectionState === "connected" ||
    peer.iceConnectionState === "completed"
  ) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("WebRTC did not connect in time.")),
      6000,
    );
    const cleanup = () => {
      clearTimeout(timeout);
      peer.removeEventListener("connectionstatechange", checkState);
      peer.removeEventListener("iceconnectionstatechange", checkState);
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
  });
}

function waitForFirstVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("WebRTC connected but no video frame arrived."));
    }, 10_000);
    const cleanup = () => {
      clearTimeout(timeout);
      video.removeEventListener("loadeddata", onFrame);
      video.removeEventListener("playing", onFrame);
      video.removeEventListener("error", onError);
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
    video.addEventListener("loadeddata", onFrame);
    video.addEventListener("playing", onFrame);
    video.addEventListener("error", onError);
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

function reportConnectionFailure(
  peer: RTCPeerConnection,
  reject: (error: Error) => void,
): void {
  const fail = () => {
    if (
      peer.connectionState === "failed" ||
      peer.connectionState === "closed" ||
      peer.iceConnectionState === "failed" ||
      peer.iceConnectionState === "closed"
    ) {
      reject(
        new Error(
          `WebRTC connection ${peer.connectionState}/${peer.iceConnectionState}.`,
        ),
      );
    }
  };
  peer.addEventListener("connectionstatechange", fail);
  peer.addEventListener("iceconnectionstatechange", fail);
}

function watchConnectionFailure(peer: RTCPeerConnection): Promise<never> {
  return new Promise((_, reject) => {
    reportConnectionFailure(peer, reject);
  });
}

function showVideoAfterFirstFrame(
  video: HTMLVideoElement,
  ui: ViewerUi,
): Promise<void> {
  return waitForFirstVideoFrame(video).then(() => {
    ui.showVideo();
  });
}

function waitForActiveVideo(
  peer: RTCPeerConnection,
  video: HTMLVideoElement,
  ui: ViewerUi,
): Promise<void> {
  return Promise.race([
    showVideoAfterFirstFrame(video, ui),
    watchConnectionFailure(peer),
  ]);
}

function recoveryVideo(target: HTMLVideoElement): HTMLVideoElement {
  if (target.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return target;
  }
  const candidate = document.createElement("video");
  candidate.autoplay = true;
  candidate.muted = true;
  candidate.playsInline = true;
  return candidate;
}

async function activateRecoveryVideo(
  candidate: HTMLVideoElement,
  target: HTMLVideoElement,
  audioRequested: boolean,
): Promise<void> {
  if (candidate === target) {
    return;
  }
  const previousStream = target.srcObject;
  const nextStream = candidate.srcObject;
  candidate.pause();
  candidate.srcObject = null;
  target.srcObject = nextStream;
  if (previousStream instanceof MediaStream) {
    for (const track of previousStream.getTracks()) {
      track.stop();
    }
  }
  await playVideoWithAutoplayFallback(target, audioRequested);
}

function disposeRecoveryVideo(
  candidate: HTMLVideoElement,
  target: HTMLVideoElement,
): void {
  if (candidate !== target) {
    clearVideo(candidate);
  }
}

function waitForTrack(
  connection: RTCPeerConnection,
  video: HTMLVideoElement,
  audioRequested: boolean,
  jitterController: AdaptiveJitterBufferController,
): Promise<void> {
  const mediaStream = new MediaStream();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("WebRTC connected but no video track arrived."));
    }, 6000);
    const cleanup = () => {
      clearTimeout(timeout);
      connection.removeEventListener("track", onTrack);
    };
    const onTrack = (event: RTCTrackEvent) => {
      jitterController.add(event.receiver);
      const [stream] = event.streams;
      if (stream) {
        video.srcObject = stream;
      } else {
        mediaStream.addTrack(event.track);
        video.srcObject = mediaStream;
      }
      if (event.track.kind === "video") {
        void playVideoWithAutoplayFallback(video, audioRequested);
        cleanup();
        resolve();
      }
    };
    connection.addEventListener("track", onTrack);
  });
}

async function playVideoWithAutoplayFallback(
  video: HTMLVideoElement,
  audioRequested: boolean,
): Promise<void> {
  video.muted = !audioRequested;
  try {
    await video.play();
  } catch {
    video.muted = true;
    await video.play().catch(() => undefined);
  }
}

function waitForConnectedTrackAndFrame(
  connection: RTCPeerConnection,
  video: HTMLVideoElement,
  ui: ViewerUi,
  trackReady: Promise<void>,
): Promise<void> {
  return waitForConnected(connection)
    .then(() => trackReady)
    .then(() => waitForActiveVideo(connection, video, ui));
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
    frameCallbackHandle = frameCallback.request((_at, metadata) => {
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
  getRelayMetrics,
}: WebrtcStreamOptions) {
  let peer: RTCPeerConnection | null = null;
  let terminalFailure = false;
  let stopMetricsMonitor: (() => void) | null = null;
  let stopConnectionMonitor: (() => void) | null = null;
  let retryTimer = 0;
  let retriesUsed = 0;
  let reconnectCount = 0;
  let peerGeneration = 0;

  video.addEventListener(
    "pointerdown",
    () => {
      if (config.audio) {
        video.muted = false;
      }
      void video.play().catch(() => undefined);
    },
    { passive: true },
  );

  const failPermanently = (reason: string, sessionExpired = false) => {
    if (terminalFailure || lifecycle.isClosing()) {
      return;
    }
    terminalFailure = true;
    stopMetricsMonitor?.();
    stopMetricsMonitor = null;
    stopConnectionMonitor?.();
    stopConnectionMonitor = null;
    if (sessionExpired) {
      emitViewerSessionExpired("webrtc", config.sessionId);
    } else {
      emitViewerStreamStatus({
        code: "stream-error",
        severity: "error",
        blocking: true,
        message: reason,
        transport: "webrtc",
      });
    }
    const activePeer = peer;
    peer = null;
    activePeer?.close();
    ui.showFailure(reason);
  };

  lifecycle.onClose(() => {
    stopMetricsMonitor?.();
    stopMetricsMonitor = null;
    stopConnectionMonitor?.();
    stopConnectionMonitor = null;
    if (retryTimer) {
      window.clearTimeout(retryTimer);
    }
    closePeer(peer, video);
  });

  const retryOrFail = (reason: string) => {
    if (terminalFailure || lifecycle.isClosing() || retryTimer) {
      return;
    }
    reconnectCount += 1;
    stopMetricsMonitor?.();
    stopMetricsMonitor = null;
    stopConnectionMonitor?.();
    stopConnectionMonitor = null;
    const stalePeer = peer;
    peer = null;
    stalePeer?.close();
    if (retriesUsed >= webrtcRetryDelaysMs.length) {
      console.warn("WebRTC recovery exhausted.", reason);
      failPermanently(
        `WebRTC stopped after ${webrtcRetryDelaysMs.length} recovery attempts: ${reason}`,
      );
      return;
    }
    const delayMs = webrtcRetryDelaysMs[retriesUsed]!;
    retriesUsed += 1;
    emitViewerStreamStatus({
      code: "reconnecting",
      severity: "info",
      blocking: false,
      message: `Recovering WebRTC video (${retriesUsed}/${webrtcRetryDelaysMs.length})...`,
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
    if (!config.sessionId) {
      failPermanently("Open the viewer again from the app page.");
      return;
    }
    if (!("RTCPeerConnection" in window)) {
      failPermanently("This browser does not support WebRTC playback.");
      return;
    }

    ui.showStatus(
      "Starting WebRTC...",
      "Starting live display",
      "Rebroid is opening the app screen.",
    );
    const currentGeneration = ++peerGeneration;
    const connection = new RTCPeerConnection();
    const jitterController = new AdaptiveJitterBufferController();
    const playbackVideo = recoveryVideo(video);
    peer = connection;
    const reliableChannel = connection.createDataChannel("rebroid-control", {
      ordered: true,
    });
    const movementChannel = connection.createDataChannel("rebroid-pointer", {
      ordered: false,
      maxRetransmits: 0,
    });
    controlChannel.useDataChannels(reliableChannel, movementChannel);
    const videoTransceiver = connection.addTransceiver("video", {
      direction: "recvonly",
    });
    preferH264PacketizationModeOne(videoTransceiver);
    if (config.audio) {
      connection.addTransceiver("audio", { direction: "recvonly" });
    }
    playbackVideo.muted = playbackVideo === video ? !config.audio : true;

    try {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      await waitForIceGathering(connection);
      const trackReady = waitForTrack(
        connection,
        playbackVideo,
        playbackVideo === video && config.audio,
        jitterController,
      );

      const offerAt = performance.timeOrigin + performance.now();
      const response = await fetch(
        `/rebroid/display/public/sessions/${encodeURIComponent(config.sessionId)}/webrtc/offer`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
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
          if (
            peer === connection &&
            peerGeneration === currentGeneration &&
            !lifecycle.isClosing()
          ) {
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
        if (response.status >= 400 && response.status < 500) {
          throw new PermanentWebrtcError(detail);
        }
        throw new Error(detail);
      }
      const answer = (await response.json()) as WebrtcAnswer;
      if (!answer.sdp) {
        throw new Error("WebRTC answer was missing SDP.");
      }
      await connection.setRemoteDescription({
        type: "answer",
        sdp: answer.sdp,
      });
      await waitForConnectedTrackAndFrame(
        connection,
        playbackVideo,
        ui,
        trackReady,
      );
      if (peer !== connection || peerGeneration !== currentGeneration) {
        disposeRecoveryVideo(playbackVideo, video);
        connection.close();
        return;
      }
      await activateRecoveryVideo(playbackVideo, video, config.audio);
      if (peer !== connection || peerGeneration !== currentGeneration) return;
      emitViewerSessionReady("webrtc", config.sessionId, offerAt);
      retriesUsed = 0;
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
        () => retryOrFail("WebRTC video stopped presenting frames."),
        reliableChannel,
      );
      stopConnectionMonitor?.();
      stopConnectionMonitor = monitorConnection(connection, currentGeneration);
    } catch (error) {
      disposeRecoveryVideo(playbackVideo, video);
      if (peer === connection && peerGeneration === currentGeneration) {
        const reason =
          error instanceof Error ? error.message : "WebRTC recovery failed.";
        if (error instanceof PermanentWebrtcError) {
          failPermanently(reason, error instanceof WebrtcSessionExpiredError);
        } else {
          retryOrFail(reason);
        }
      } else {
        connection.close();
      }
    }
  }

  async function connect(): Promise<void> {
    retriesUsed = 0;
    await connectAttempt();
  }

  return {
    connect,
    scheduleReconnect() {
      retryOrFail("WebRTC reconnection requested.");
    },
  };
}
