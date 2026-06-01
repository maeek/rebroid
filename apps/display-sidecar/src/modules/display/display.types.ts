export type DisplaySessionStatus =
  | "created"
  | "active"
  | "released"
  | "expired";

export interface DisplaySession {
  id: string;
  appId?: string;
  udid: string;
  ownerUserId?: string;
  status: DisplaySessionStatus;
  token: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  maxExpiresAt: string;
  capabilities: string[];
}

export interface PublicDisplaySession
  extends Omit<DisplaySession, "token" | "udid" | "ownerUserId"> {
  streamPath: string;
  viewerPath: string;
  webrtcOfferPath: string;
}

export interface CreateDisplaySessionBody {
  appId?: string;
  udid: string;
  ownerUserId?: string;
  ttlSeconds?: number;
  capabilities?: string[];
}

export interface DisplayActionBody {
  command?: string;
  action?: string;
}

export interface PublicDisplayActionBody extends DisplayActionBody {
  token?: string | null;
}

export interface DisplayKeyboardBody {
  token?: string | null;
  eventType?: "keydown" | "keyup";
  key?: string;
  code?: string;
  repeat?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

export interface DisplayTouchBody {
  token?: string | null;
  action?: "tap" | "swipe" | "pointer";
  eventType?: "down" | "move" | "up" | "cancel";
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

export interface DisplayClipboardBody {
  text?: string;
}
