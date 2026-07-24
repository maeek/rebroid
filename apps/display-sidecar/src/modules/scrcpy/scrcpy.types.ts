import type { ScrcpyPacket } from "./scrcpy-packet-parser";
import type { MediaQueueSnapshot } from "./scrcpy-media-queue";

export type ScrcpyVideoCodec = "h264";
export type ScrcpyTunnelMode = "direct" | "reverse" | "forward";
export type ScrcpyCompatibilityMode =
  | "normal"
  | "audio-disabled"
  | "stream-control-disabled";

export interface ScrcpyAudioPacket {
  data: Buffer;
  timestampUs: bigint;
  config: boolean;
}

export interface ScrcpyMediaSinkSnapshot {
  sourceVideoFrames: number;
  sourceVideoBytes?: number;
  sourceKeyFrames?: number;
  lastKeyFrameBytes?: number;
  sourceFrameSizeP95Bytes?: number;
  sourceInterFrameP95Ms?: number;
  lastVideoSequence?: number;
  video: MediaQueueSnapshot;
  audio: MediaQueueSnapshot;
  scrcpyReadToSinkWriteP95Ms?: number;
  scrcpyReadToSinkWriteP99Ms?: number;
  eventLoopUtilization?: number;
  gcPauseP95Ms?: number;
}

export interface ScrcpyMediaSink {
  isOpen: () => boolean;
  onClose: (listener: (code?: number, reason?: Buffer) => void) => void;
  sendStatus: (payload: unknown) => void;
  writeVideo: (
    packet: ScrcpyPacket,
    completion?: (error?: Error) => void,
  ) => void;
  writeAudio: (
    packet: ScrcpyAudioPacket,
    completion?: (error?: Error) => void,
  ) => void;
  snapshot: () => ScrcpyMediaSinkSnapshot;
  close: (code?: number, reason?: string) => void;
}

export interface ScrcpyRequestedProfile {
  codec: ScrcpyVideoCodec;
  maxSize: number;
  maxFps: number;
  bitrate: number;
  iFrameInterval: number;
  audio: boolean;
  control: boolean;
}

export interface ScrcpyStreamOptions {
  sessionId: string;
  udid: string;
  sink: ScrcpyMediaSink;
  codec: ScrcpyVideoCodec;
  displayId?: number;
  newDisplay?: {
    width: number;
    height: number;
    dpi: number;
  };
  maxSize: number;
  maxFps: number;
  bitrate: number;
  audio: boolean;
  control?: boolean;
  compatibilityMode?: ScrcpyCompatibilityMode;
  iFrameInterval?: number;
  requestedProfile?: ScrcpyRequestedProfile;
  onActivity?: () => void;
}

export interface ScrcpyStreamAttachment {
  sourceAttemptId: string;
  consumerId: string;
  closed: Promise<void>;
  detach: (reason?: string) => void;
  requestVideoReset: (reason: string) => boolean;
  awaitVideoBootstrap: (timeoutMs?: number) => Promise<ScrcpyVideoBootstrap>;
}

export interface ScrcpyVideoBootstrap {
  configuration: Buffer;
  keyFrame: Buffer;
  configurationTimestampUs: bigint;
  keyFrameTimestampUs: bigint;
  profileLevelId: string;
  sdpFmtpLine: string;
  width?: number;
  height?: number;
  actualEncoder?: string;
}

export interface ScrcpySocket {
  destroyed: boolean;
  writable: boolean;
  destroy: (error?: Error) => ScrcpySocket;
  on: (event: string, listener: (...args: any[]) => void) => ScrcpySocket;
  once: (event: string, listener: (...args: any[]) => void) => ScrcpySocket;
  removeListener: (
    event: string,
    listener: (...args: any[]) => void,
  ) => ScrcpySocket;
  pause: () => ScrcpySocket;
  resume: () => ScrcpySocket;
  setNoDelay: (noDelay?: boolean) => ScrcpySocket;
  write: (payload: Buffer | Uint8Array | string) => boolean;
}

export interface ForwardedVideoSocket {
  socket: ScrcpySocket;
  initialPayload: Buffer;
}

export interface ScrcpyAttemptResult {
  reason: string;
  durationMs: number;
  bytesForwarded: number;
}
