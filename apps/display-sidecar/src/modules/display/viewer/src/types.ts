export type ViewerConfig = {
  params: URLSearchParams;
  sessionId: string | null;
  token: string | null;
  transport: "webrtc" | "websocket";
  audio: boolean;
  streamDefaults: Record<string, string>;
};

export type ViewerElements = {
  title: HTMLElement | null;
  copy: HTMLElement | null;
  status: HTMLElement | null;
  compatibility: HTMLElement | null;
  message: HTMLElement | null;
  canvas: HTMLCanvasElement;
  snapshot: HTMLCanvasElement;
  video: HTMLVideoElement;
};

export type ViewerUi = {
  showStatus: (text: string, nextTitle?: string, nextCopy?: string) => void;
  showFailure: (text: string) => void;
  showCanvas: () => void;
  showVideo: () => void;
  preserveVideoFrame: (source: HTMLVideoElement) => boolean;
  showStarting: (text?: string) => void;
  showCompatibility: (mode: string, message?: string) => void;
};

export type PageLifecycle = {
  isClosing: () => boolean;
  onClose: (callback: () => void) => () => boolean;
};

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonRecord = Record<string, JsonValue>;

export type ControlChannel = {
  connect: () => WebSocket | null;
  useDataChannels: (
    reliable: RTCDataChannel,
    movement?: RTCDataChannel,
  ) => void;
  send: (
    messagePayload: JsonRecord,
    fallbackPath: string,
    fallbackPayload?: JsonRecord,
  ) => Promise<void>;
};

export type TouchPoint = {
  x: number;
  y: number;
};

export type TouchPayload =
  | {
      action: "tap";
      x: number;
      y: number;
      videoWidth: number;
      videoHeight: number;
    }
  | {
      action: "pointer";
      eventType: "down" | "move" | "up" | "cancel";
      x: number;
      y: number;
      videoWidth: number;
      videoHeight: number;
    }
  | {
      action: "swipe";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      durationMs: number;
      videoWidth: number;
      videoHeight: number;
    };

export type TouchInputPayload =
  | Omit<Extract<TouchPayload, { action: "tap" }>, "videoWidth" | "videoHeight">
  | Omit<
      Extract<TouchPayload, { action: "pointer" }>,
      "videoWidth" | "videoHeight"
    >
  | Omit<
      Extract<TouchPayload, { action: "swipe" }>,
      "videoWidth" | "videoHeight"
    >;

export type DisplayDecoder = {
  appendVideoFrame: (
    frame: import("./media-frame.js").ViewerMediaFrame,
  ) => Promise<void> | void;
  reset: () => void;
  hasFrames: () => boolean;
  debugState: () => JsonRecord;
};

export type DisplayTransport = {
  connect: () => Promise<void>;
  scheduleReconnect: () => void;
};

export type ViewerStreamStatusCode =
  | "audio-disabled"
  | "reconnecting"
  | "first-frame-timeout"
  | "video-stalled"
  | "stream-error";

export type ViewerStreamStatusSeverity = "info" | "warning" | "error";

export type ViewerStreamStatus = {
  code: ViewerStreamStatusCode;
  severity: ViewerStreamStatusSeverity;
  blocking: boolean;
  message: string;
  transport?: "webrtc" | "websocket";
};

export type ViewerEffectiveProfile = {
  transport: "webrtc" | "websocket";
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

export type ViewerRelayMetrics = {
  sourceFps: number;
  droppedFrames: number;
  queueDepthMs: number;
  sourceBitrateMbps?: number;
  sourceFrameSizeP95Bytes?: number;
  keyFrameSizeBytes?: number;
  sourceInterFrameP95Ms?: number;
  relayP95Ms?: number;
  relayP99Ms?: number;
  eventLoopUtilization?: number;
  gcPauseP95Ms?: number;
  bridgeNackCount?: number;
  bridgePliCount?: number;
  bridgePacketsLost?: number;
  bridgeRoundTripTimeMs?: number;
  bridgeInputFps?: number;
  rtpSentFps?: number;
  rtpPacketizationP95Ms?: number;
  rtpWriteP95Ms?: number;
  rtpSendErrors?: number;
  retransmittedPackets?: number;
  retransmittedBytes?: number;
  packetsDiscardedOnSend?: number;
  rtpSendDelayMs?: number;
  actualEncoder?: string;
  width?: number;
  height?: number;
  h264ProfileLevelId?: string;
  negotiatedH264ProfileLevelId?: string;
  sourceAttemptId?: string;
};

export type ViewerRendererBackend =
  | "webrtc-video"
  | "chromium-webcodecs"
  | "firefox-mse"
  | "webcodecs-webgl2-fallback";

export type ViewerStreamMetricsV4 = {
  version: 4;
  transport: "webrtc" | "websocket";
  sourceFps?: number;
  relayIngressFps?: number;
  bridgeInputFps?: number;
  rtpSentFps?: number;
  receivedFps?: number;
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
  consumerGeneration?: number;
  effectiveProfile: ViewerEffectiveProfile;
  collectedAt: number;
};
