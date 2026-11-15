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

export type ViewerStreamMetricsV4 = {
  version: 4;
  transport: ViewerTransport;
  displaySizePresentation?: DisplaySizePresentation;
  sourceFps?: number;
  relayIngressFps?: number;
  bridgeInputFps?: number;
  rtpSentFps?: number;
  receivedFps?: number;
  receivedFrames?: number;
  decodedFrames?: number;
  presentedFrames?: number;
  receiverPacketsLost?: number;
  receiverNackCount?: number;
  receiverPliCount?: number;
  frameAcknowledgement?: FrameAcknowledgementStatus;
  frameAcknowledgementsSent?: number;
  decodedFps?: number;
  drawnFps?: number;
  presentedFps?: number;
  wireBitrateMbps?: number;
  sourceBitrateMbps?: number;
  sourceFrameSizeP95Bytes?: number;
  keyFrameSizeBytes?: number;
  frameGapP50Ms?: number;
  frameGapP95Ms?: number;
  frameGapP99Ms?: number;
  frameGapMaxMs?: number;
  sourceInterFrameP95Ms?: number;
  networkInterArrivalJitterP95Ms?: number;
  decodeP95Ms?: number;
  decodeToDrawP95Ms?: number;
  liveEdgeAgeP95Ms?: number;
  relayQueueDepthMs?: number;
  relayP95Ms?: number;
  relayP99Ms?: number;
  rtpPacketizationP95Ms?: number;
  rtpWriteP95Ms?: number;
  rtpSendErrors?: number;
  eventLoopUtilization?: number;
  gcPauseP95Ms?: number;
  decoderQueueDepth?: number;
  pendingRenderFrames?: number;
  audioQueueDepthMs?: number;
  webrtcJitterBufferDepthMs?: number;
  jitterBufferTargetMs?: number;
  mseBufferedLeadMs?: number;
  relayDroppedFrames?: number;
  decodeDroppedFrames?: number;
  presentationDroppedFrames?: number;
  audioDroppedFrames?: number;
  freezeCount?: number;
  reconnectCount?: number;
  resyncCount?: number;
  videoResetCount?: number;
  sourceRestartCount?: number;
  roundTripTimeMs?: number;
  packetsLost?: number;
  nackCount?: number;
  pliCount?: number;
  retransmittedPackets?: number;
  retransmittedBytes?: number;
  packetsDiscardedOnSend?: number;
  rtpSendDelayMs?: number;
  mainThreadLongTaskCount?: number;
  highestReceivedSequence?: number;
  highestDecodedSequence?: number;
  highestPresentedSequence?: number;
  presentationSequenceLag?: number;
  width?: number;
  height?: number;
  renderer: ViewerRendererBackend;
  decoderPreference?: "hardware" | "software" | "native";
  h264ProfileLevelId?: string;
  negotiatedH264ProfileLevelId?: string;
  sourceAttemptId?: string;
  consumerAttemptId?: string;
  sourceCodecGeneration?: number;
  videoResetGeneration?: number;
  videoResetCompletedGeneration?: number;
  videoResetElapsedMs?: number;

  consumerGeneration?: number;
  effectiveProfile: ViewerEffectiveProfile;
  collectedAt: number;
};

export type ViewerStreamStatusMessage = ViewerStreamStatus & {
  type: "rebroid-viewer-stream-status";
};

export type ViewerStreamMetricsMessage = ViewerStreamMetricsV4 & {
  type: "rebroid-viewer-stream-metrics-v4";
};
