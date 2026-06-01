import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import {
  CreateDisplaySessionBody,
  DisplaySession,
  PublicDisplaySession,
} from "./display.types";

@Injectable()
export class DisplaySessionService {
  private readonly sessions = new Map<string, DisplaySession>();

  constructor(private readonly config: SidecarConfigService) {}

  create(body: CreateDisplaySessionBody): PublicDisplaySession {
    if (!body.udid?.trim()) {
      throw new BadRequestException("udid is required.");
    }

    const reusable = this.findReusable(body);
    if (reusable) {
      this.extend(reusable);
      return this.toPublic(reusable);
    }

    const now = new Date();
    const ttlSeconds = body.ttlSeconds ?? this.config.sessionTtlSeconds;
    const session: DisplaySession = {
      id: randomUUID(),
      appId: body.appId,
      udid: body.udid.trim(),
      ownerUserId: body.ownerUserId,
      status: "created",
      token: randomBytes(32).toString("base64url"),
      createdAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
      maxExpiresAt: new Date(
        now.getTime() + this.config.sessionMaxLifetimeSeconds * 1000,
      ).toISOString(),
      capabilities: body.capabilities ?? [
        "stream",
        "audio",
        "clipboard",
        "files",
        "input",
        "screenshot",
      ],
    };

    this.sessions.set(session.id, session);
    return this.toPublic(session);
  }

  list(): PublicDisplaySession[] {
    this.expireOldSessions();
    return [...this.sessions.values()].map((session) => this.toPublic(session));
  }

  get(id: string): DisplaySession {
    this.expireOldSessions();
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

  release(id: string): PublicDisplaySession {
    const session = this.get(id);
    session.status = "released";
    session.lastActivityAt = new Date().toISOString();
    return this.toPublic(session);
  }

  releaseForApp(appId: string): PublicDisplaySession[] {
    return [...this.sessions.values()]
      .filter((session) => session.appId === appId)
      .map((session) => {
        session.status = "released";
        session.lastActivityAt = new Date().toISOString();
        return this.toPublic(session);
      });
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
    if (!session.capabilities.includes(capability)) {
      throw new BadRequestException(
        `Display session does not allow ${capability}.`,
      );
    }
  }

  toPublic(session: DisplaySession): PublicDisplaySession {
    return {
      id: session.id,
      appId: session.appId,
      status: session.status,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
      maxExpiresAt: session.maxExpiresAt,
      capabilities: session.capabilities,
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
    const capabilities = body.capabilities ?? [
      "stream",
      "audio",
      "clipboard",
      "files",
      "input",
      "screenshot",
    ];
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
        this.sameCapabilities(session.capabilities, capabilities)
      );
    });
  }

  private sameCapabilities(left: string[], right: string[]) {
    return (
      left.length === right.length &&
      left.every((capability) => right.includes(capability))
    );
  }

  private expireOldSessions() {
    const now = Date.now();
    for (const session of this.sessions.values()) {
      if (
        session.status !== "released" &&
        new Date(session.expiresAt).getTime() <= now
      ) {
        session.status = "expired";
      }
    }
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
