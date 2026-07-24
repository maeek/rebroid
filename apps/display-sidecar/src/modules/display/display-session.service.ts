import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { SidecarFeatureService } from "../shared/sidecar-feature.service";
import {
  CreateDisplaySessionBody,
  CreateDisplaySurfaceBody,
  DisplayNewDisplayConfig,
  DisplaySession,
  DisplaySurface,
  PublicDisplaySession,
} from "./display.types";

const MAIN_SURFACE_ID = "main";
const VIRTUAL_SURFACE_LIMIT = 1;
const DEFAULT_VIRTUAL_DISPLAY: DisplayNewDisplayConfig = {
  width: 1280,
  height: 720,
  dpi: 160,
};
const DEFAULT_DISPLAY_CAPABILITIES = [
  "video",
  "audio",
  "control",
  "clipboard",
  "files",
  "screenshot",
  "diagnostics",
] as const;

@Injectable()
export class DisplaySessionService {
  private readonly sessions = new Map<string, DisplaySession>();
  private readonly closeListeners = new Set<(sessionId: string) => void>();

  constructor(
    private readonly config: SidecarConfigService,
    private readonly features: SidecarFeatureService,
  ) {}

  create(body: CreateDisplaySessionBody): PublicDisplaySession {
    if (!body.udid?.trim()) {
      throw new BadRequestException("udid is required.");
    }

    this.purgeInactiveSessions();
    const reusable = this.findReusable(body);
    if (reusable) {
      this.extend(reusable);
      return this.toPublic(reusable);
    }

    if (this.sessions.size >= this.config.sessionMaxActive) {
      throw new HttpException(
        {
          statusCode: 429,
          code: "display_session_capacity_exceeded",
          message: "The display sidecar has reached its active session limit.",
        },
        429,
      );
    }

    const now = new Date();
    const ttlSeconds = body.ttlSeconds ?? this.config.sessionTtlSeconds;
    const session: DisplaySession = {
      id: randomUUID(),
      appId: body.appId,
      udid: body.udid.trim(),
      ownerUserId: body.ownerUserId,
      surfaceId: body.surfaceId ?? MAIN_SURFACE_ID,
      surfaceKind: body.surfaceKind ?? "main",
      displayName:
        body.displayName ??
        (body.surfaceKind === "virtual" ? "Virtual display" : "Main display"),
      displayId: this.validDisplayId(body.displayId),
      newDisplay: body.newDisplay,
      status: "created",
      token: randomBytes(32).toString("base64url"),
      createdAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
      maxExpiresAt: new Date(
        now.getTime() + this.config.sessionMaxLifetimeSeconds * 1000,
      ).toISOString(),
      capabilities: this.normalizeCapabilities(body.capabilities),
    };

    this.sessions.set(session.id, session);
    return this.toPublic(session);
  }

  createVirtualSurface(
    parentSessionId: string,
    body: CreateDisplaySurfaceBody = {},
  ): PublicDisplaySession {
    this.features.assertVirtualDisplayEnabled();
    const parent = this.get(parentSessionId);
    if (parent.surfaceKind !== "main") {
      throw new BadRequestException(
        "Virtual displays can only be added from the main display session.",
      );
    }

    const existing = this.findActiveSurfaces(parent).filter(
      (session) => session.surfaceKind === "virtual",
    );
    if (existing.length >= VIRTUAL_SURFACE_LIMIT) {
      this.extend(existing[0]);
      return this.toPublic(existing[0]);
    }

    return this.create({
      appId: parent.appId,
      udid: parent.udid,
      ownerUserId: parent.ownerUserId,
      capabilities: parent.capabilities,
      surfaceId: `virtual-${randomUUID()}`,
      surfaceKind: "virtual",
      displayName: body.name?.trim() || "Virtual display",
      newDisplay: this.normalizeNewDisplay(body),
    });
  }

  list(): PublicDisplaySession[] {
    this.purgeInactiveSessions();
    return [...this.sessions.values()].map((session) => this.toPublic(session));
  }

  get(id: string): DisplaySession {
    this.purgeInactiveSessions();
    const session = this.sessions.get(id);
    if (!session) {
      throw new NotFoundException("Display session not found.");
    }
    return session;
  }

  getPublic(id: string): PublicDisplaySession {
    return this.toPublic(this.get(id));
  }

  touch(id: string) {
    const session = this.get(id);
    this.extend(session);
    return session;
  }

  onClosed(listener: (sessionId: string) => void): () => void {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  release(id: string): PublicDisplaySession {
    const session = this.get(id);
    session.status = "released";
    session.lastActivityAt = new Date().toISOString();
    const released = this.toPublic(session);
    this.sessions.delete(id);
    this.notifyClosed(id);
    return released;
  }

  releaseForApp(appId: string): PublicDisplaySession[] {
    const released = [...this.sessions.values()]
      .filter((session) => session.appId === appId)
      .map((session) => {
        session.status = "released";
        session.lastActivityAt = new Date().toISOString();
        return this.toPublic(session);
      });
    for (const session of released) {
      this.sessions.delete(session.id);
      this.notifyClosed(session.id);
    }
    return released;
  }

  releaseSurface(
    parentSessionId: string,
    surfaceId: string,
  ): PublicDisplaySession {
    const parent = this.get(parentSessionId);
    const surface = this.findActiveSurfaces(parent).find(
      (session) => session.surfaceId === surfaceId,
    );
    if (!surface) {
      throw new NotFoundException("Display surface not found.");
    }
    if (surface.surfaceKind === "main") {
      throw new BadRequestException("Main display surface cannot be closed.");
    }

    surface.status = "released";
    surface.lastActivityAt = new Date().toISOString();
    const released = this.toPublic(surface);
    this.sessions.delete(surface.id);
    this.notifyClosed(surface.id);
    return released;
  }

  assertStreamToken(id: string, token: string | null): DisplaySession {
    const session = this.get(id);
    if (session.token !== token) {
      throw new BadRequestException("Display session token is invalid.");
    }
    if (session.status === "released" || session.status === "expired") {
      throw new BadRequestException(`Display session is ${session.status}.`);
    }
    session.status = "active";
    this.extend(session);
    return session;
  }

  assertCapability(session: DisplaySession, capability: string) {
    const normalized = this.normalizeCapability(capability);
    if (!session.capabilities.includes(normalized)) {
      throw new BadRequestException({
        statusCode: 400,
        code: "missing_capability",
        capability: normalized,
        message: `Display session does not allow ${normalized}.`,
      });
    }
  }

  toPublic(session: DisplaySession): PublicDisplaySession {
    const surface = this.toSurface(session);
    return {
      id: session.id,
      appId: session.appId,
      surfaceId: session.surfaceId,
      surfaceKind: session.surfaceKind,
      displayName: session.displayName,
      displayId: session.displayId,
      newDisplay: session.newDisplay,
      status: session.status,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
      maxExpiresAt: session.maxExpiresAt,
      capabilities: session.capabilities,
      surface,
      surfaces: this.findActiveSurfaces(session).map((item) =>
        this.toSurface(item),
      ),
      streamPath: `/rebroid/display/stream?sessionId=${encodeURIComponent(session.id)}&token=${encodeURIComponent(
        session.token,
      )}`,
      viewerPath: `/viewer/display?sessionId=${encodeURIComponent(session.id)}&token=${encodeURIComponent(
        session.token,
      )}`,
      webrtcOfferPath: `/rebroid/display/public/sessions/${encodeURIComponent(session.id)}/webrtc/offer`,
    };
  }

  private findReusable(body: CreateDisplaySessionBody) {
    const now = Date.now();
    const capabilities = this.normalizeCapabilities(body.capabilities);
    return [...this.sessions.values()].find((session) => {
      if (session.status === "released" || session.status === "expired") {
        return false;
      }
      if (new Date(session.expiresAt).getTime() <= now) {
        return false;
      }
      return (
        session.udid === body.udid &&
        session.appId === body.appId &&
        session.ownerUserId === body.ownerUserId &&
        session.surfaceKind === (body.surfaceKind ?? "main") &&
        session.surfaceId === (body.surfaceId ?? MAIN_SURFACE_ID) &&
        this.sameCapabilities(session.capabilities, capabilities)
      );
    });
  }

  private sameCapabilities(left: string[], right: string[]) {
    const normalizedLeft = this.normalizeCapabilities(left);
    const normalizedRight = this.normalizeCapabilities(right);
    return (
      normalizedLeft.length === normalizedRight.length &&
      normalizedLeft.every((capability) => normalizedRight.includes(capability))
    );
  }

  private normalizeCapabilities(capabilities?: string[]) {
    const normalized = (capabilities ?? [...DEFAULT_DISPLAY_CAPABILITIES])
      .map((capability) => capability.trim())
      .filter(Boolean);
    return [...new Set(normalized)];
  }

  private normalizeCapability(capability: string) {
    return capability.trim();
  }

  private purgeInactiveSessions() {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (
        session.status === "released" ||
        new Date(session.expiresAt).getTime() <= now
      ) {
        session.status = "expired";
        this.sessions.delete(id);
        this.notifyClosed(id);
      }
    }
  }

  private notifyClosed(sessionId: string): void {
    for (const listener of this.closeListeners) {
      listener(sessionId);
    }
  }

  private findActiveSurfaces(session: DisplaySession) {
    this.purgeInactiveSessions();
    return [...this.sessions.values()]
      .filter((candidate) => {
        if (candidate.status === "released" || candidate.status === "expired") {
          return false;
        }

        if (candidate.surfaceKind === "main" && candidate.id !== session.id) {
          return false;
        }

        return (
          candidate.appId === session.appId &&
          candidate.udid === session.udid &&
          candidate.ownerUserId === session.ownerUserId
        );
      })
      .sort((left, right) => {
        if (left.surfaceKind !== right.surfaceKind) {
          return left.surfaceKind === "main" ? -1 : 1;
        }

        return left.createdAt.localeCompare(right.createdAt);
      });
  }

  private toSurface(session: DisplaySession): DisplaySurface {
    return {
      id: session.surfaceId,
      sessionId: session.id,
      kind: session.surfaceKind,
      name: session.displayName,
      status: session.status,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      streamPath: `/rebroid/display/stream?sessionId=${encodeURIComponent(session.id)}&token=${encodeURIComponent(
        session.token,
      )}`,
      viewerPath: `/viewer/display?sessionId=${encodeURIComponent(session.id)}&token=${encodeURIComponent(
        session.token,
      )}`,
      webrtcOfferPath: `/rebroid/display/public/sessions/${encodeURIComponent(session.id)}/webrtc/offer`,
      displayId: session.displayId,
      newDisplay: session.newDisplay,
    };
  }

  private normalizeNewDisplay(body: CreateDisplaySurfaceBody) {
    const width = this.dimension(body.width, DEFAULT_VIRTUAL_DISPLAY.width);
    const height = this.dimension(body.height, DEFAULT_VIRTUAL_DISPLAY.height);
    const dpi = this.dimension(body.dpi, DEFAULT_VIRTUAL_DISPLAY.dpi);

    return { width, height, dpi };
  }

  private dimension(value: number | undefined, fallback: number) {
    if (!Number.isFinite(value)) {
      return fallback;
    }

    return Math.min(Math.max(Math.round(value!), 1), 4096);
  }

  private validDisplayId(value: number | undefined) {
    if (!Number.isInteger(value) || value! < 0) {
      return undefined;
    }

    return value;
  }

  private extend(session: DisplaySession) {
    const now = new Date();
    session.lastActivityAt = now.toISOString();
    session.expiresAt = new Date(
      Math.min(
        now.getTime() + this.config.sessionTtlSeconds * 1000,
        new Date(session.maxExpiresAt).getTime(),
      ),
    ).toISOString();
  }
}
