import { WebSocket } from "ws";

export const SCRCPY_WS_OPEN = WebSocket.OPEN;

export type ScrcpyVideoCodec = "h264" | "h265";
export type ScrcpyTunnelMode = "direct" | "reverse" | "forward";
export type ScrcpyCompatibilityMode =
  | "normal"
  | "audio-disabled"
  | "stream-control-disabled"
  | "stable-video";

export interface ScrcpyAudioPacket {
  data: Buffer;
  timestampUs: bigint;
  config: boolean;
}

export interface ScrcpyStreamClient {
  readyState: number;
  bufferedAmount: number;
  audioBufferedAmount?: number;
  once: (
    event: "close",
    listener: (code?: number, reason?: Buffer) => void,
  ) => unknown;
  send: (...args: any[]) => unknown;
  sendAudio?: (
    packet: ScrcpyAudioPacket,
    callback?: (error?: Error) => void,
  ) => unknown;
  close?: (code?: number, reason?: string) => unknown;
}

export interface ScrcpyStreamOptions {
  sessionId: string;
  udid: string;
  client: ScrcpyStreamClient;
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
  onActivity?: () => void;
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
