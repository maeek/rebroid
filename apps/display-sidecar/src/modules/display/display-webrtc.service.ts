import { ConflictException, Injectable } from "@nestjs/common";
import { ScrcpyService } from "../scrcpy/scrcpy.service";
import type { ScrcpyStreamOptions } from "../scrcpy/scrcpy.types";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { SidecarFeatureService } from "../shared/sidecar-feature.service";
import { DisplaySessionService } from "./display-session.service";
import { DisplayControlService } from "./display-control.service";
import { resolveDisplayStreamProfile } from "./display-stream-profile";
import { DisplayWebrtcAttempt } from "./display-webrtc-attempt";
import { spawnWebrtcBridge } from "./display-webrtc-bridge";

type WebrtcOfferOptions = {
  sessionId: string;
  token: string | null;
  sdp: string;
  requestHost: string | null;
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
  ) {}

  async createAnswer(options: WebrtcOfferOptions) {
    const { sessionId, sdp, audio } = options;
    const session = this.sessions.assertStreamToken(sessionId, options.token);
    this.sessions.assertCapability(session, "video");
    this.features.assertWebrtcEnabled();
    const iceHost = this.resolveIceHost(options.requestHost);
    if (!iceHost) {
      throw new ConflictException("Could not determine WebRTC ICE host.");
    }

    const sourceOptions = this.sourceOptions(options, session);
    this.stopSession(sessionId);
    const attempt = new DisplayWebrtcAttempt({
      sessionId,
      sdp,
      audio,
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
        if (this.active.get(sessionId) === attempt)
          this.active.delete(sessionId);
      },
    });
    this.active.set(sessionId, attempt);
    return attempt.run();
  }

  stopSession(sessionId: string) {
    this.active.get(sessionId)?.stop();
  }

  private sourceOptions(
    options: WebrtcOfferOptions,
    session: ReturnType<DisplaySessionService["assertStreamToken"]>,
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
      audio: options.audio,
      ...profile,
      onActivity: () => this.sessions.touch(options.sessionId),
    };
  }

  private resolveIceHost(requestHost: string | null) {
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
