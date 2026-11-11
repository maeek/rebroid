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
  runtimeId?: string;
  udid: string;
  ownerUserId?: string;
  surfaceId: string;
  surfaceKind: DisplaySurfaceKind;
  displayName: string;
  displayId?: number;
  newDisplay?: DisplayNewDisplayConfig;
  status: DisplaySessionStatus;
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
  extends Omit<DisplaySession, "udid" | "ownerUserId" | "runtimeId"> {
  surface: DisplaySurface;
  surfaces: DisplaySurface[];
  streamPath: string;
  viewerPath: string;
  webrtcOfferPath: string;
}

export interface CreateDisplaySessionBody {
  appId?: string;
  runtimeId?: string;
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

export interface DisplayClipboardBody {
  text?: string;
}

export type DisplayControlRequest =
  | { id?: string; type: "action"; command?: string }
  | ({ id?: string; type: "keyboard" } & KeyboardControlPayload)
  | ({ id?: string; type: "touch" } & TouchControlPayload)
  | { id?: string; type: "clipboard"; text?: string };
