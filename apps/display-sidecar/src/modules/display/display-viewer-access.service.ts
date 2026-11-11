import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { IncomingHttpHeaders } from "node:http";
import { z } from "zod";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { DisplaySessionService } from "./display-session.service";
import type { DisplaySession } from "./display.types";

const authorizationSchema = z.object({
  ownerUserId: z.string().min(1).max(200),
  capabilities: z.object({
    control: z.boolean(),
    clipboard: z.boolean(),
    screenshot: z.boolean(),
  }),
});
const sessionIdSchema = z.uuid();
// Keep the authorization path uniform for an unknown or foreign session ID.
const missingTarget = {
  appId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  runtimeId: "0".repeat(64),
  ownerUserId: "-",
};
const recheckIntervalMs = 10_000;
const authorizationTimeoutMs = 2_000;

const sessionUnavailable = () =>
  new NotFoundException({
    code: "display_session_unavailable",
    message: "Display session not found.",
    statusCode: 404,
  });

@Injectable()
export class DisplayViewerAccessService {
  constructor(
    private readonly config: SidecarConfigService,
    private readonly sessions: DisplaySessionService,
  ) {}

  async admit(id: string, headers: IncomingHttpHeaders) {
    const credentials = this.browserCredentials(headers);
    if (!sessionIdSchema.safeParse(id).success) throw sessionUnavailable();

    const authorize = async (signal?: AbortSignal) => {
      const session = this.sessions.find(id);
      const target =
        session?.appId && session.ownerUserId && session.runtimeId
          ? {
              appId: session.appId,
              ownerUserId: session.ownerUserId,
              runtimeId: session.runtimeId,
            }
          : missingTarget;
      const account = await this.readAccount(credentials, target, signal);
      if (
        !session ||
        target === missingTarget ||
        this.sessions.get(id) !== session ||
        account.ownerUserId !== session.ownerUserId ||
        !session.capabilities.every((capability) => {
          if (capability === "video" || capability === "audio") return true;
          if (
            capability === "control" ||
            capability === "clipboard" ||
            capability === "screenshot"
          ) {
            return account.capabilities[capability];
          }
          return false;
        })
      ) {
        throw sessionUnavailable();
      }
      return session;
    };

    const session = await authorize();
    this.sessions.activate(session);
    return {
      session,
      watch: (onRevoked: () => void) =>
        this.watch(session, authorize, onRevoked),
    };
  }

  private browserCredentials(headers: IncomingHttpHeaders) {
    const { host, origin } = headers;
    const protocol =
      headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const cookie = headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .filter((part) =>
        /^(?:__Secure-)?next-auth\.session-token(?:\.\d+)?=/.test(part),
      )
      .join("; ");
    if (!host || !origin || !cookie) throw new UnauthorizedException();
    let expected: string;
    try {
      expected = new URL(`${protocol}://${host}`).origin;
    } catch {
      throw new UnauthorizedException();
    }
    if (origin !== expected) throw new UnauthorizedException();
    return { cookie, host, protocol };
  }

  private async readAccount(
    credentials: ReturnType<DisplayViewerAccessService["browserCredentials"]>,
    target: typeof missingTarget,
    signal?: AbortSignal,
  ) {
    try {
      const secret = this.config.sharedSecret;
      if (!secret) throw sessionUnavailable();
      const timeout = AbortSignal.timeout(authorizationTimeoutMs);
      const response = await fetch(
        new URL("/api/internal/viewer/authorize", this.config.webInternalUrl),
        {
          headers: {
            cookie: credentials.cookie,
            "x-forwarded-host": credentials.host,
            "x-forwarded-proto": credentials.protocol,
            "x-orchestrator-secret": secret,
            "x-rebroid-viewer-app": target.appId,
            "x-rebroid-viewer-runtime": target.runtimeId,
            "x-rebroid-viewer-owner": target.ownerUserId,
          },
          redirect: "error",
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        },
      );
      if (response.ok) return authorizationSchema.parse(await response.json());
      await response.body?.cancel();
    } catch {
      // Never include the request or its credentials in public errors or logs.
    }
    throw sessionUnavailable();
  }

  private watch(
    session: DisplaySession,
    authorize: (signal: AbortSignal) => Promise<DisplaySession>,
    onRevoked: () => void,
  ) {
    this.sessions.get(session.id);
    const controller = new AbortController();
    let timer: NodeJS.Timeout;
    const stop = () => {
      clearTimeout(timer);
      unsubscribe();
      controller.abort();
    };
    const revoke = () => {
      if (controller.signal.aborted) return;
      stop();
      onRevoked();
    };
    const unsubscribe = this.sessions.onClosed((id) => {
      if (id === session.id) revoke();
    });
    const schedule = () => {
      if (controller.signal.aborted) return;
      timer = setTimeout(() => {
        void authorize(controller.signal).then(schedule, revoke);
      }, recheckIntervalMs);
      timer.unref();
    };
    schedule();
    return stop;
  }
}
