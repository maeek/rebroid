import type {
  KeyboardControlPayload,
  TouchControlPayload,
} from "../shared/display-control.types";

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
  surfaceId: string;
  surfaceKind: DisplaySurfaceKind;
  displayName: string;
  displayId?: number;
  newDisplay?: DisplayNewDisplayConfig;
  status: DisplaySessionStatus;
  token: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  maxExpiresAt: string;
  capabilities: string[];
}

export type DisplaySurfaceKind = "main" | "virtual";

export interface DisplayNewDisplayConfig {
  width: number;
  height: number;
  dpi: number;
}

export interface DisplaySurface {
  id: string;
  sessionId: string;
  kind: DisplaySurfaceKind;
  name: string;
  status: DisplaySessionStatus;
  createdAt: string;
  lastActivityAt: string;
  streamPath: string;
  viewerPath: string;
  webrtcOfferPath: string;
  displayId?: number;
  newDisplay?: DisplayNewDisplayConfig;
}

export interface PublicDisplaySession
  extends Omit<DisplaySession, "token" | "udid" | "ownerUserId"> {
  surface: DisplaySurface;
  surfaces: DisplaySurface[];
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
  surfaceId?: string;
  surfaceKind?: DisplaySurfaceKind;
  displayName?: string;
  displayId?: number;
  newDisplay?: DisplayNewDisplayConfig;
}

export interface CreateDisplaySurfaceBody {
  name?: string;
  width?: number;
  height?: number;
  dpi?: number;
}

export interface DisplayActionBody {
  command?: string;
}

export interface PublicDisplayActionBody extends DisplayActionBody {
  token?: string | null;
}

export interface DisplayKeyboardBody extends KeyboardControlPayload {
  token?: string | null;
}

export interface DisplayTouchBody extends TouchControlPayload {
  token?: string | null;
}

export interface DisplayClipboardBody {
  text?: string;
}

export type DisplayControlRequest =
  | { id?: string; type: "action"; command?: string }
  | ({ id?: string; type: "keyboard" } & DisplayKeyboardBody)
  | ({ id?: string; type: "touch" } & DisplayTouchBody)
  | { id?: string; type: "clipboard"; text?: string };
