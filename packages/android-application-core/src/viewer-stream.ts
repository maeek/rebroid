import type { ViewerTransport } from "./viewer-control";

export type ViewerFrameObservation = { connectAt: number; presentedAt: number };

export type ViewerStreamStatusCode =
  | "audio-disabled"
  | "reconnecting"
  | "first-frame-timeout"
  | "video-stalled"
  | "session-expired"
  | "session-ready"
  | "stream-error";

export type ViewerStreamStatusSeverity = "info" | "warning" | "error";

export type ViewerStreamStatus = {
  code: ViewerStreamStatusCode;
  severity: ViewerStreamStatusSeverity;
  blocking: boolean;
  message: string;
  sessionId?: string | null;
  startup?: ViewerFrameObservation;
  consumerAttemptId?: string;
  closeCode?: number;
  failureStage?: string;
  transport?: ViewerTransport;
};

export type ViewerEffectiveProfile = {
  transport: ViewerTransport;
  codec: string;
  maxSize: number;
  maxFps: number;
  bitrate: number;
  iFrameInterval: number;
  audio: boolean;
  control?: boolean;
  tunnel?: string;
  actualEncoder?: string;
  width?: number;
  height?: number;
  pixelRate?: number;
  h264ProfileLevelId?: string;
  negotiatedH264ProfileLevelId?: string;
  sourceAttemptId?: string;
};

export type DisplayFrameSize = { width: number; height: number };

export type DisplaySizePresentation = {
  previous: DisplayFrameSize;
  current: DisplayFrameSize;
  elapsedMs?: number;
};

export type FrameAcknowledgementStatus =
  | "callback-unavailable"
  | "waiting-for-frame"
  | "timestamp-unavailable"
  | "waiting-for-quiet"
  | "window-expired"
  | "channel-unavailable"
  | "channel-buffered"
  | "send-failed"
  | "sent";

export type ViewerRendererBackend =
  | "webrtc-video"
  | "chromium-webcodecs"
  | "firefox-mse"
  | "webcodecs-webgl2-fallback";

export const optionalViewerStreamMetricFields = [
  "sourceFps",
  "relayIngressFps",
  "bridgeInputFps",
  "rtpSentFps",
  "receivedFps",
  "receivedFrames",
  "decodedFrames",
  "presentedFrames",
  "receiverPacketsLost",
  "receiverNackCount",
  "receiverPliCount",
  "frameAcknowledgementsSent",
  "decodedFps",
  "drawnFps",
  "presentedFps",
  "wireBitrateMbps",
  "sourceBitrateMbps",
  "sourceFrameSizeP95Bytes",
  "keyFrameSizeBytes",
  "frameGapP50Ms",
  "frameGapP95Ms",
  "frameGapP99Ms",
  "frameGapMaxMs",
  "sourceInterFrameP95Ms",
  "networkInterArrivalJitterP95Ms",
  "decodeP95Ms",
  "decodeToDrawP95Ms",
  "liveEdgeAgeP95Ms",
  "relayQueueDepthMs",
  "relayP95Ms",
  "relayP99Ms",
  "rtpPacketizationP95Ms",
  "rtpWriteP95Ms",
  "rtpSendErrors",
  "eventLoopUtilization",
  "gcPauseP95Ms",
  "decoderQueueDepth",
  "pendingRenderFrames",
  "audioQueueDepthMs",
  "webrtcJitterBufferDepthMs",
  "jitterBufferTargetMs",
  "mseBufferedLeadMs",
  "relayDroppedFrames",
  "decodeDroppedFrames",
  "presentationDroppedFrames",
  "audioDroppedFrames",
  "freezeCount",
  "reconnectCount",
  "resyncCount",
  "videoResetCount",
  "sourceRestartCount",
  "roundTripTimeMs",
  "packetsLost",
  "nackCount",
  "pliCount",
  "retransmittedPackets",
  "retransmittedBytes",
  "packetsDiscardedOnSend",
  "rtpSendDelayMs",
  "mainThreadLongTaskCount",
  "highestReceivedSequence",
  "highestDecodedSequence",
  "highestPresentedSequence",
  "presentationSequenceLag",
  "width",
  "height",
  "sourceCodecGeneration",
  "videoResetGeneration",
  "videoResetCompletedGeneration",
  "videoResetElapsedMs",
  "consumerGeneration",
] as const;

export type ViewerStreamMetricsV4 = Partial<
  Record<(typeof optionalViewerStreamMetricFields)[number], number>
> & {
  version: 4;
  transport: ViewerTransport;
  displaySizePresentation?: DisplaySizePresentation;
  frameAcknowledgement?: FrameAcknowledgementStatus;
  renderer: ViewerRendererBackend;
  decoderPreference?: "hardware" | "software" | "native";
  h264ProfileLevelId?: string;
  negotiatedH264ProfileLevelId?: string;
  sourceAttemptId?: string;
  consumerAttemptId?: string;
  effectiveProfile: ViewerEffectiveProfile;
  collectedAt: number;
};

export const viewerStreamStatusMessageType = "rebroid-viewer-stream-status";

export type ViewerStreamStatusMessage = ViewerStreamStatus & {
  type: typeof viewerStreamStatusMessageType;
};

export const viewerStreamMetricsMessageType =
  "rebroid-viewer-stream-metrics-v4";

export type ViewerStreamMetricsMessage = ViewerStreamMetricsV4 & {
  type: typeof viewerStreamMetricsMessageType;
};
