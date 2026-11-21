export interface KeyboardControlPayload {
  eventType?: "keydown" | "keyup";
  key?: string;
  code?: string;
  repeat?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

export interface TouchControlPayload {
  action?: "tap" | "swipe" | "pointer";
  eventType?: "down" | "move" | "up" | "cancel";
  pointerId?: number;
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

export interface ScrollControlPayload {
  x: number;
  y: number;
  videoWidth: number;
  videoHeight: number;
  horizontal: number;
  vertical: number;
}
