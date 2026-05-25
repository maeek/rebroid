import { WebSocket } from 'ws';

export type ScrcpyVideoCodec = 'h264' | 'h265';
export type ScrcpyTunnelMode = 'direct' | 'reverse' | 'forward';

export interface ScrcpyStreamOptions {
  sessionId: string;
  udid: string;
  client: WebSocket;
  codec: ScrcpyVideoCodec;
  maxSize: number;
  maxFps: number;
  bitrate: number;
  iFrameInterval?: number;
  onActivity?: () => void;
}

export interface ScrcpyKeyboardEventPayload {
  eventType?: 'keydown' | 'keyup';
  key?: string;
  code?: string;
  repeat?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

export interface ScrcpyTouchEventPayload {
  action?: 'tap' | 'swipe';
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  videoWidth?: number;
  videoHeight?: number;
  durationMs?: number;
}

export interface ScrcpySocket {
  destroyed: boolean;
  writable: boolean;
  destroy: (error?: Error) => ScrcpySocket;
  on: (event: string, listener: (...args: any[]) => void) => ScrcpySocket;
  once: (event: string, listener: (...args: any[]) => void) => ScrcpySocket;
  removeListener: (event: string, listener: (...args: any[]) => void) => ScrcpySocket;
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
