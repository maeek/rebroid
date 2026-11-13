import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  type OnModuleDestroy,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import { ScrcpyService } from "../scrcpy/scrcpy.service";
import type { ScrcpyStreamOptions } from "../scrcpy/scrcpy.types";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { SidecarFeatureService } from "../shared/sidecar-feature.service";
import { DisplaySessionService } from "./display-session.service";
import { DisplayViewerAccessService } from "./display-viewer-access.service";
import type { DisplaySession } from "./display.types";
import { DisplayControlService } from "./display-control.service";
import { resolveDisplayStreamProfile } from "./display-stream-profile";
import { DisplayWebrtcAttempt } from "./display-webrtc-attempt";
import { DisplayWebrtcProcess } from "./display-webrtc-process";

type WebrtcOfferOptions = {
  sessionId: string;
  headers: IncomingHttpHeaders;
  signal?: AbortSignal;
  sdp: string;
  bitrate?: number;
  maxFps?: number;
  maxSize?: number;
  iFrameInterval?: number;
  audio: boolean;
};

const viewerIdHeader = "x-rebroid-viewer-id";

@Injectable()
export class DisplayWebrtcService implements OnModuleDestroy {
  private readonly active = new Map<
    string,
    { sessionId: string; sequence: number; attempt: DisplayWebrtcAttempt }
  >();
  private nextSequence = 0;
  private stopping = false;
  private readonly bridge: DisplayWebrtcProcess;
  private readonly maxPeers: number;

  constructor(
    private readonly sessions: DisplaySessionService,
    private readonly scrcpy: ScrcpyService,
    private readonly config: SidecarConfigService,
    private readonly controls: DisplayControlService,
    private readonly features: SidecarFeatureService,
    private readonly access: DisplayViewerAccessService,
  ) {
    this.maxPeers = config.sessionMaxActive * 2;
    this.bridge = new DisplayWebrtcProcess(
      config.webrtcBridgePath,
      config.webrtcUdpPort,
      this.maxPeers,
    );
  }

  onModuleDestroy() {
    this.stopping = true;
    for (const { attempt } of this.active.values()) {
      attempt.stop(undefined, "sidecar_shutdown");
    }
    this.bridge.close();
  }

  async createAnswer(options: WebrtcOfferOptions) {
    const { sessionId, sdp, signal } = options;
    const sequence = ++this.nextSequence;
    signal?.throwIfAborted();
    const admission = await this.access.admit(
      sessionId,
      options.headers,
      signal,
    );
    signal?.throwIfAborted();
    if (this.stopping)
      throw new ServiceUnavailableException("WebRTC is shutting down.");
    const { session } = admission;
    this.sessions.assertCapability(session, "video");
    this.features.assertWebrtcEnabled();
    const iceHost = this.resolveIceHost(options.headers.host);
    if (!iceHost) {
      throw new ConflictException("Could not determine WebRTC ICE host.");
    }

    const sourceOptions = this.sourceOptions(options, session);
    const viewerId = options.headers[viewerIdHeader];
    if (
      viewerId !== undefined &&
      (typeof viewerId !== "string" || !/^[a-f0-9]{32}$/.test(viewerId))
    ) {
      throw new BadRequestException("Invalid WebRTC viewer ID.");
    }
    // An offer without a viewer ID cannot replace an existing browser consumer.
    const key = JSON.stringify([
      sessionId,
      admission.accountSessionKey,
      viewerId ?? randomBytes(16).toString("hex"),
    ]);
    const previous = this.active.get(key);
    if (previous && previous.sequence > sequence) {
      throw new ConflictException("A newer offer already opened this viewer.");
    }
    if (!previous && this.active.size >= this.maxPeers) {
      throw new HttpException(
        {
          statusCode: 429,
          code: "display_peer_capacity_exceeded",
          message: "The display sidecar has reached its WebRTC viewer limit.",
        },
        429,
      );
    }

    const attempt = new DisplayWebrtcAttempt({
      sessionId,
      sdp,
      audio: sourceOptions.audio,
      allowClipboard: session.capabilities.includes("clipboard"),
      iceHost,
      maxFps: sourceOptions.maxFps,
      iceServers: this.config.webrtcStunUrls,
      attachSource: (sink) =>
        this.scrcpy.attachStream({ ...sourceOptions, sink }, "bootstrap"),
      launchBridge: (signal, attemptId) =>
        this.bridge.connect(signal, attemptId),
      executeControl: (request) => this.controls.execute(sessionId, request),
      onFinish: () => {
        signal?.removeEventListener("abort", onAbandon);
        stopWatching();
        if (this.active.get(key)?.attempt === attempt) this.active.delete(key);
      },
    });
    const stopWatching = admission.watch(() =>
      attempt.stop(
        new NotFoundException("Display session not found."),
        "access_revoked",
      ),
    );
    const onAbandon = () => attempt.stop(signal?.reason, "offer_abandoned");
    signal?.addEventListener("abort", onAbandon, { once: true });
    if (signal?.aborted) {
      onAbandon();
      signal.throwIfAborted();
    }
    this.active.set(key, { sessionId, sequence, attempt });
    previous?.attempt.stop(undefined, "viewer_replaced");
    return attempt.run();
  }

  stopSession(sessionId: string) {
    for (const entry of this.active.values()) {
      if (entry.sessionId === sessionId) {
        entry.attempt.stop(undefined, "display_session_closed");
      }
    }
  }

  private sourceOptions(
    options: WebrtcOfferOptions,
    session: DisplaySession,
  ): Omit<ScrcpyStreamOptions, "sink"> {
    let profile: ReturnType<typeof resolveDisplayStreamProfile>;
    try {
      profile = resolveDisplayStreamProfile(options);
    } catch (error) {
      throw new ConflictException(
        error instanceof Error ? error.message : String(error),
      );
    }
    return {
      sessionId: options.sessionId,
      udid: session.udid,
      codec: "h264",
      displayId: session.displayId,
      newDisplay: session.newDisplay,
      audio: options.audio && session.capabilities.includes("audio"),
      ...profile,
      onActivity: () => this.sessions.touch(options.sessionId),
    };
  }

  private resolveIceHost(requestHost: string | undefined) {
    if (this.config.webrtcIceHostOverride) {
      return this.config.webrtcIceHostOverride;
    }
    const first = requestHost?.split(",")[0]?.trim();
    if (!first) {
      return "";
    }
    return first.startsWith("[")
      ? first.slice(1, first.indexOf("]"))
      : first.split(":")[0];
  }
}
