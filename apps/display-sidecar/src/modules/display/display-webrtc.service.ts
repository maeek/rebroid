import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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
import { spawnWebrtcBridge } from "./display-webrtc-bridge";

type WebrtcOfferOptions = {
  sessionId: string;
  headers: IncomingHttpHeaders;
  sdp: string;
  bitrate?: number;
  maxFps?: number;
  maxSize?: number;
  iFrameInterval?: number;
  audio: boolean;
};

@Injectable()
export class DisplayWebrtcService {
  private readonly active = new Map<string, DisplayWebrtcAttempt>();

  constructor(
    private readonly sessions: DisplaySessionService,
    private readonly scrcpy: ScrcpyService,
    private readonly config: SidecarConfigService,
    private readonly controls: DisplayControlService,
    private readonly features: SidecarFeatureService,
    private readonly access: DisplayViewerAccessService,
  ) {}

  async createAnswer(options: WebrtcOfferOptions) {
    const { sessionId, sdp } = options;
    const admission = await this.access.admit(sessionId, options.headers);
    const { session } = admission;
    this.sessions.assertCapability(session, "video");
    this.features.assertWebrtcEnabled();
    const iceHost = this.resolveIceHost(options.headers.host);
    if (!iceHost) {
      throw new ConflictException("Could not determine WebRTC ICE host.");
    }

    const sourceOptions = this.sourceOptions(options, session);
    const attempt = new DisplayWebrtcAttempt({
      sessionId,
      sdp,
      audio: sourceOptions.audio,
      allowClipboard: session.capabilities.includes("clipboard"),
      iceHost,
      maxFps: sourceOptions.maxFps,
      iceServers: this.config.webrtcStunUrls,
      udpPortRange: this.config.webrtcUdpPortRange,
      assertSourceSupported: () =>
        this.scrcpy.assertTargetSupported(session.udid),
      attachSource: (sink) =>
        this.scrcpy.attachStream({ ...sourceOptions, sink }),
      launchBridge: () => spawnWebrtcBridge(this.config.webrtcBridgePath),
      executeControl: (request) => this.controls.execute(sessionId, request),
      onFinish: () => {
        stopWatching();
        if (this.active.get(sessionId) === attempt)
          this.active.delete(sessionId);
      },
    });
    const stopWatching = admission.watch(() =>
      attempt.stop(new NotFoundException("Display session not found.")),
    );
    this.stopSession(sessionId);
    this.active.set(sessionId, attempt);
    return attempt.run();
  }

  stopSession(sessionId: string) {
    this.active.get(sessionId)?.stop();
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
