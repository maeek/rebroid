export type ViewerConfig = {
  params: URLSearchParams;
  sessionId: string | null;
  transport: "webrtc" | "websocket";
  audio: boolean;
  streamDefaults: Record<string, string>;
};

export type ViewerElements = {
  title: HTMLElement | null;
  copy: HTMLElement | null;
  status: HTMLElement | null;
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
};

export type PageLifecycle = {
  isClosing: () => boolean;
  onClose: (callback: () => void) => () => boolean;
  hasDemand: () => boolean;
  onDemandChange: (callback: (active: boolean) => void) => () => boolean;
};

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type JsonRecord = Record<string, JsonValue>;

export type ControlChannel = {
  connect: () => WebSocket | null;
  canSendLiveInput: () => boolean;
  sendScroll: (payload: JsonRecord) => void;
  useDataChannels: (
    reliable: RTCDataChannel,
    movement?: RTCDataChannel,
    onCodecChanged?: () => void,
    onVideoReset?: (remainingMs: number) => void,
    canControl?: boolean,
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

export type ViewerRelayMetrics = {
  sourceFps: number;
  sourceVideoFrames?: number;
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
  consumerAttemptId?: string;
  sourceCodecGeneration?: number;
  videoResetGeneration?: number;
  videoResetCompletedGeneration?: number;
  videoResetElapsedMs?: number;
  videoResetCount?: number;
};
