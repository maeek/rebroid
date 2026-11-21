import { summarizeFrameGaps } from "./frame-gap-metrics.js";
import type {
  DisplaySizePresentation,
  FrameAcknowledgementStatus,
  ViewerEffectiveProfile,
  ViewerStreamMetricsV4,
} from "@rebroid/android-application-core/viewer-stream";
import type { ViewerRelayMetrics } from "./types.js";

type WebrtcReceiverTotals = {
  bytesReceived: number;
  framesReceived: number;
  framesDecoded: number;
  jitterBufferDelay: number;
  jitterBufferEmittedCount: number;
};

// Keep recent presentation gaps bounded even when getStats stops responding.
const maxFrameGapSamples = 240;

export class WebrtcFrameGapSamples {
  private readonly gaps: number[] = [];
  private nextIndex = 0;

  add(gapMs: number): void {
    this.gaps[this.nextIndex] = gapMs;
    this.nextIndex = (this.nextIndex + 1) % maxFrameGapSamples;
  }

  takeSummary() {
    const summary = summarizeFrameGaps(this.gaps);
    this.gaps.length = 0;
    this.nextIndex = 0;
    return summary;
  }
}

export type WebrtcIntervalSample = {
  receiver: WebrtcReceiverTotals;
  presentedFrames?: number;
  droppedFrames: number;
  sampledAt: number;
};

function metricReportNumber(
  report: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = report[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function readWebrtcReceiverStats(
  stats: RTCStatsReport,
  previous: WebrtcReceiverTotals,
) {
  const receiver = { ...previous };
  let droppedFrames: number | undefined;
  let packetsLost: number | undefined;
  let nackCount: number | undefined;
  let pliCount: number | undefined;
  let networkJitterMs: number | undefined;
  let roundTripTimeMs: number | undefined;

  stats.forEach((report: RTCStats) => {
    const details = report as RTCStats & Record<string, unknown>;
    if (
      report.type === "inbound-rtp" &&
      details.kind === "video" &&
      details.isRemote !== true
    ) {
      receiver.bytesReceived =
        metricReportNumber(details, "bytesReceived") ?? receiver.bytesReceived;
      receiver.framesReceived =
        metricReportNumber(details, "framesReceived") ??
        receiver.framesReceived;
      receiver.framesDecoded =
        metricReportNumber(details, "framesDecoded") ?? receiver.framesDecoded;
      receiver.jitterBufferDelay =
        metricReportNumber(details, "jitterBufferDelay") ??
        receiver.jitterBufferDelay;
      receiver.jitterBufferEmittedCount =
        metricReportNumber(details, "jitterBufferEmittedCount") ??
        receiver.jitterBufferEmittedCount;
      droppedFrames = metricReportNumber(details, "framesDropped");
      packetsLost = metricReportNumber(details, "packetsLost");
      nackCount = metricReportNumber(details, "nackCount");
      pliCount = metricReportNumber(details, "pliCount");
      const jitterSeconds = metricReportNumber(details, "jitter");
      networkJitterMs =
        jitterSeconds === undefined ? undefined : jitterSeconds * 1_000;
    }
    if (
      (report.type === "candidate-pair" &&
        (details.selected === true || details.nominated === true)) ||
      report.type === "remote-inbound-rtp"
    ) {
      const seconds =
        metricReportNumber(details, "currentRoundTripTime") ??
        metricReportNumber(details, "roundTripTime");
      if (seconds !== undefined) roundTripTimeMs = seconds * 1_000;
    }
  });

  return {
    receiver,
    droppedFrames,
    packetsLost,
    nackCount,
    pliCount,
    networkJitterMs,
    roundTripTimeMs,
  };
}

export function calculateWebrtcIntervalMetrics(
  previous: WebrtcIntervalSample,
  current: WebrtcIntervalSample,
) {
  const elapsedSeconds = Math.max(
    (current.sampledAt - previous.sampledAt) / 1_000,
    0.001,
  );
  const jitterDelayDelta =
    current.receiver.jitterBufferDelay - previous.receiver.jitterBufferDelay;
  const jitterEmittedDelta =
    current.receiver.jitterBufferEmittedCount -
    previous.receiver.jitterBufferEmittedCount;
  const presentedFps =
    current.presentedFrames === undefined ||
    previous.presentedFrames === undefined
      ? undefined
      : (current.presentedFrames - previous.presentedFrames) / elapsedSeconds;

  return {
    receivedFps:
      (current.receiver.framesReceived - previous.receiver.framesReceived) /
      elapsedSeconds,
    decodedFps:
      (current.receiver.framesDecoded - previous.receiver.framesDecoded) /
      elapsedSeconds,
    presentedFps,
    wireBitrateMbps:
      ((current.receiver.bytesReceived - previous.receiver.bytesReceived) * 8) /
      elapsedSeconds /
      1_000_000,
    jitterQueueDepthMs:
      jitterEmittedDelta > 0
        ? (jitterDelayDelta / jitterEmittedDelta) * 1_000
        : undefined,
    droppedFramesDelta: Math.max(
      0,
      current.droppedFrames - previous.droppedFrames,
    ),
  };
}

type WebrtcMetricsReportInput = {
  displaySizePresentation?: DisplaySizePresentation;
  receiverStats: ReturnType<typeof readWebrtcReceiverStats>;
  intervalMetrics: ReturnType<typeof calculateWebrtcIntervalMetrics>;
  gapMetrics: ReturnType<WebrtcFrameGapSamples["takeSummary"]>;
  relayMetrics: ViewerRelayMetrics | null;
  effectiveProfile: ViewerEffectiveProfile;
  presentedFrames?: number;
  frameAcknowledgement: FrameAcknowledgementStatus;
  frameAcknowledgementsSent: number;
  jitterBufferTargetMs: number;
  freezeCount: number;
  reconnectCount: number;
  mainThreadLongTaskCount: number;
  width?: number;
  height?: number;
  consumerGeneration: number;
  negotiatedProfileLevelId?: string;
  collectedAt: number;
};

export function buildWebrtcMetricsReport({
  displaySizePresentation,
  receiverStats,
  intervalMetrics,
  gapMetrics,
  relayMetrics,
  effectiveProfile,
  presentedFrames,
  frameAcknowledgement,
  frameAcknowledgementsSent,
  jitterBufferTargetMs,
  freezeCount,
  reconnectCount,
  mainThreadLongTaskCount,
  width,
  height,
  consumerGeneration,
  negotiatedProfileLevelId,
  collectedAt,
}: WebrtcMetricsReportInput): ViewerStreamMetricsV4 {
  const {
    receiver: { framesReceived: receivedFrames, framesDecoded: decodedFrames },
    droppedFrames,
    packetsLost,
    nackCount,
    pliCount,
    networkJitterMs,
    roundTripTimeMs,
  } = receiverStats;
  const {
    receivedFps,
    decodedFps,
    presentedFps,
    wireBitrateMbps,
    jitterQueueDepthMs,
  } = intervalMetrics;
  return {
    version: 4,
    transport: "webrtc",
    displaySizePresentation,
    sourceFps: relayMetrics?.sourceFps,
    relayIngressFps: relayMetrics?.sourceFps,
    bridgeInputFps: relayMetrics?.bridgeInputFps,
    rtpSentFps: relayMetrics?.rtpSentFps,
    receivedFps,
    receivedFrames,
    decodedFrames,
    presentedFrames,
    receiverPacketsLost: packetsLost,
    receiverNackCount: nackCount,
    receiverPliCount: pliCount,
    frameAcknowledgement,
    frameAcknowledgementsSent,
    consumerAttemptId: relayMetrics?.consumerAttemptId,
    sourceCodecGeneration: relayMetrics?.sourceCodecGeneration,
    videoResetGeneration: relayMetrics?.videoResetGeneration,
    videoResetCompletedGeneration: relayMetrics?.videoResetCompletedGeneration,
    videoResetElapsedMs: relayMetrics?.videoResetElapsedMs,
    videoResetCount: relayMetrics?.videoResetCount,
    decodedFps,
    drawnFps: presentedFps,
    presentedFps,
    wireBitrateMbps,
    sourceBitrateMbps: relayMetrics?.sourceBitrateMbps,
    sourceFrameSizeP95Bytes: relayMetrics?.sourceFrameSizeP95Bytes,
    keyFrameSizeBytes: relayMetrics?.keyFrameSizeBytes,
    sourceInterFrameP95Ms: relayMetrics?.sourceInterFrameP95Ms,
    networkInterArrivalJitterP95Ms: networkJitterMs,
    ...gapMetrics,
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
    jitterBufferTargetMs,
    relayDroppedFrames: relayMetrics?.droppedFrames ?? 0,
    decodeDroppedFrames: droppedFrames ?? 0,
    presentationDroppedFrames: 0,
    freezeCount,
    reconnectCount,
    roundTripTimeMs: roundTripTimeMs ?? relayMetrics?.bridgeRoundTripTimeMs,
    packetsLost: packetsLost ?? relayMetrics?.bridgePacketsLost,
    nackCount: relayMetrics?.bridgeNackCount ?? nackCount,
    pliCount: relayMetrics?.bridgePliCount ?? pliCount,
    retransmittedPackets: relayMetrics?.retransmittedPackets,
    retransmittedBytes: relayMetrics?.retransmittedBytes,
    packetsDiscardedOnSend: relayMetrics?.packetsDiscardedOnSend,
    rtpSendDelayMs: relayMetrics?.rtpSendDelayMs,
    mainThreadLongTaskCount,
    width,
    height,
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
          ? relayMetrics.width * relayMetrics.height * effectiveProfile.maxFps
          : undefined,
      h264ProfileLevelId: relayMetrics?.h264ProfileLevelId,
      negotiatedH264ProfileLevelId: negotiatedProfileLevelId,
      sourceAttemptId: relayMetrics?.sourceAttemptId,
    },
    collectedAt,
  };
}
