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
  context: CanvasRenderingContext2D;
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
  useDataChannel: (channel: RTCDataChannel) => void;
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
  appendStreamBytes: (bytes: Uint8Array<ArrayBufferLike>) => Promise<void>;
  appendVideoPacket: (bytes: Uint8Array<ArrayBufferLike>) => Promise<void>;
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
  | "transport-fallback"
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
