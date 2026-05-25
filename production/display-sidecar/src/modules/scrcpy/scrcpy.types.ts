import { WebSocket } from 'ws';

export type ScrcpyVideoCodec = 'h264' | 'h265';

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
