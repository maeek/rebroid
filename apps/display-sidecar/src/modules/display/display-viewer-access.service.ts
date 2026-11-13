import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import { z } from "zod";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { DisplaySessionService } from "./display-session.service";
import type { DisplaySession } from "./display.types";

const authorizationSchema = z.object({
  ownerUserId: z.string().min(1).max(200),
  accountSessionId: z.string().min(1).max(128).optional(),
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

type AccessWatch = {
  listeners: Set<() => void>;
  stop: () => void;
};

const sessionUnavailable = () =>
  new NotFoundException({
    code: "display_session_unavailable",
    message: "Display session not found.",
    statusCode: 404,
  });

@Injectable()
export class DisplayViewerAccessService {
  private readonly logger = new Logger(DisplayViewerAccessService.name);
  private readonly watches = new Map<string, AccessWatch>();

  constructor(
    private readonly config: SidecarConfigService,
    private readonly sessions: DisplaySessionService,
  ) {}

  async admit(id: string, headers: IncomingHttpHeaders, signal?: AbortSignal) {
    signal?.throwIfAborted();
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
      return { session, accountSessionId: account.accountSessionId };
    };

    const { session, accountSessionId } = await authorize(signal);
    signal?.throwIfAborted();
    this.sessions.activate(session);
    const watchKey = createHash("sha256")
      .update(JSON.stringify([id, credentials]))
      .digest("hex");
    return {
      session,
      accountSessionKey: accountSessionId
        ? createHash("sha256")
            .update(JSON.stringify([id, accountSessionId]))
            .digest("hex")
        : watchKey,
      watch: (onRevoked: () => void) =>
        this.watch(watchKey, session, authorize, onRevoked),
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
    signal?.throwIfAborted();
    throw sessionUnavailable();
  }

  private watch(
    key: string,
    session: DisplaySession,
    authorize: (signal: AbortSignal) => Promise<unknown>,
    onRevoked: () => void,
  ) {
    if (this.sessions.get(session.id) !== session) throw sessionUnavailable();
    const watch =
      this.watches.get(key) ?? this.startWatch(key, session, authorize);
    const listener = () => onRevoked();
    watch.listeners.add(listener);
    return () => {
      if (watch.listeners.delete(listener) && !watch.listeners.size)
        watch.stop();
    };
  }

  private startWatch(
    key: string,
    session: DisplaySession,
    authorize: (signal: AbortSignal) => Promise<unknown>,
  ): AccessWatch {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const stop = () => {
      clearTimeout(timer);
      unsubscribe();
      controller.abort();
      if (this.watches.get(key) === watch) this.watches.delete(key);
    };
    const watch: AccessWatch = { listeners: new Set(), stop };
    const revoke = () => {
      if (controller.signal.aborted) return;
      stop();
      const listeners = [...watch.listeners];
      watch.listeners.clear();
      for (const listener of listeners) {
        try {
          listener();
        } catch {
          this.logger.warn("Display consumer failed to handle revoked access.");
        }
      }
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
    this.watches.set(key, watch);
    schedule();
    return watch;
  }
}
