import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { ChildProcess, spawn } from "node:child_process";
import { Writable } from "node:stream";
import { ScrcpyBootstrapSink } from "../scrcpy/scrcpy-bootstrap-sink";
import { QueuedScrcpyMediaSink } from "../scrcpy/scrcpy-media-sink";
import { ScrcpyService } from "../scrcpy/scrcpy.service";
import { supportsH264PixelRate } from "../scrcpy/scrcpy-h264-profile";
import type {
  ScrcpyStreamAttachment,
  ScrcpyStreamOptions,
  ScrcpyVideoBootstrap,
} from "../scrcpy/scrcpy.types";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { DisplaySessionService } from "./display-session.service";
import type { DisplayControlRequest } from "./display.types";
import { DisplayControlService } from "./display-control.service";
import { displayControlError } from "./display-control-response";
import { findCompatibleH264Offer } from "./display-webrtc-codec";

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

type BridgeMessage =
  | { type: "answer"; sdp: string }
  | { type: "control"; payload: unknown }
  | { type: "state"; state: string }
  | { type: "log"; message: string }
  | { type: "metrics"; metrics: Record<string, number> }
  | { type: "video-resync-request"; message?: string }
  | { type: "error"; message: string };

const DEFAULT_MAX_SIZE = 0;
const DEFAULT_MAX_FPS = 60;
const DEFAULT_BITRATE = 16_000_000;
const INTERACTIVE_I_FRAME_INTERVAL = 1;

@Injectable()
export class DisplayWebrtcService {
  private readonly logger = new Logger(DisplayWebrtcService.name);
  private readonly active = new Map<string, () => void>();

  constructor(
    private readonly sessions: DisplaySessionService,
    private readonly scrcpy: ScrcpyService,
    private readonly config: SidecarConfigService,
    private readonly controls: DisplayControlService,
  ) {}

  async createAnswer(options: WebrtcOfferOptions) {
    const session = this.sessions.assertStreamToken(
      options.sessionId,
      options.token,
    );
    this.sessions.assertCapability(session, "video");
    await this.scrcpy.assertTargetSupported(session.udid);
    const iceHost = this.resolveIceHost(options.requestHost);
    if (!iceHost) {
      throw new ConflictException("Could not determine WebRTC ICE host.");
    }

    this.stopSession(options.sessionId);
    const sourceOptions = this.sourceOptions(options, session);
    const bootstrapSink = new ScrcpyBootstrapSink();
    let bootstrapAttachment: ScrcpyStreamAttachment | null = null;
    try {
      bootstrapAttachment = this.scrcpy.attachStream({
        ...sourceOptions,
        sink: bootstrapSink,
      });
      const bootstrap = await bootstrapAttachment.awaitVideoBootstrap(3_000);
      this.assertBootstrapHasDimensions(bootstrap);
      this.assertOfferSupportsBootstrap(options.sdp, bootstrap);
      const declaredLevelSupportsRequestedRate = supportsH264PixelRate(
        bootstrap.profileLevelId,
        bootstrap.width!,
        bootstrap.height!,
        sourceOptions.maxFps,
      );
      if (!declaredLevelSupportsRequestedRate) {
        this.logger.warn(
          `[webrtc:${options.sessionId}] encoder SPS ${bootstrap.profileLevelId} declares a lower macroblock rate than ${bootstrap.width}x${bootstrap.height}@${sourceOptions.maxFps}; continuing because scrcpy max_fps is a variable-frame-rate cap`,
        );
      }
      return await this.createBridgeAnswer({
        options,
        sourceOptions,
        bootstrap,
        bootstrapAttachment,
        iceHost,
        declaredLevelSupportsRequestedRate,
      });
    } catch (error) {
      bootstrapAttachment?.detach("WebRTC bootstrap failed");
      throw error;
    }
  }

  private async createBridgeAnswer({
    options,
    sourceOptions,
    bootstrap,
    bootstrapAttachment,
    iceHost,
    declaredLevelSupportsRequestedRate,
  }: {
    options: WebrtcOfferOptions;
    sourceOptions: Omit<ScrcpyStreamOptions, "sink">;
    bootstrap: ScrcpyVideoBootstrap;
    bootstrapAttachment: ScrcpyStreamAttachment;
    iceHost: string;
    declaredLevelSupportsRequestedRate: boolean;
  }) {
    const bridge = spawn(this.config.webrtcBridgePath, [], {
      stdio: ["pipe", "pipe", "pipe", "pipe", "pipe"],
    });
    const videoInput = bridge.stdio[3] as Writable;
    const audioInput = bridge.stdio[4] as Writable;
    const sink = new QueuedScrcpyMediaSink({
      isOpen: () => bridge.exitCode === null && !bridge.killed,
      onClose: (listener) => {
        bridge.once("close", (code, signal) =>
          listener(code ?? undefined, signal ? Buffer.from(signal) : undefined),
        );
      },
      writeStatus: (payload) => {
        bridge.stdin?.write(
          `${JSON.stringify({ type: "datachannel", payload: JSON.parse(payload) })}\n`,
        );
      },
      writeVideo: (payload) => this.writeBridgeInput(videoInput, payload),
      writeAudio: (payload) => this.writeBridgeInput(audioInput, payload),
      close: () => {
        videoInput.end();
        audioInput.end();
        bridge.kill("SIGTERM");
      },
    });
    let attachment: ScrcpyStreamAttachment | null = null;
    let previousSourceFrames = 0;
    let previousSourceBytes = 0;
    let previousSnapshotAt = Date.now();
    const queueMetricsTimer = setInterval(() => {
      const snapshotAt = Date.now();
      const snapshot = sink.snapshot();
      const elapsedSeconds = Math.max(
        (snapshotAt - previousSnapshotAt) / 1_000,
        0.001,
      );
      sink.sendStatus({
        type: "relay-metrics",
        metrics: {
          sourceFps:
            (snapshot.sourceVideoFrames - previousSourceFrames) /
            elapsedSeconds,
          sourceBitrateMbps:
            (((snapshot.sourceVideoBytes ?? 0) - previousSourceBytes) * 8) /
            elapsedSeconds /
            1_000_000,
          sourceFrameSizeP95Bytes: snapshot.sourceFrameSizeP95Bytes,
          keyFrameSizeBytes: snapshot.lastKeyFrameBytes,
          sourceInterFrameP95Ms: snapshot.sourceInterFrameP95Ms,
          droppedFrames: snapshot.video.droppedFrames,
          queueDepthMs: snapshot.video.queueDepthMs,
          relayP95Ms: snapshot.scrcpyReadToSinkWriteP95Ms,
          relayP99Ms: snapshot.scrcpyReadToSinkWriteP99Ms,
          eventLoopUtilization: snapshot.eventLoopUtilization,
          gcPauseP95Ms: snapshot.gcPauseP95Ms,
        },
      });
      previousSourceFrames = snapshot.sourceVideoFrames;
      previousSourceBytes = snapshot.sourceVideoBytes ?? 0;
      previousSnapshotAt = snapshotAt;
    }, 1_000);
    queueMetricsTimer.unref?.();
    const close = () => {
      clearInterval(queueMetricsTimer);
      attachment?.detach("WebRTC consumer closed");
      bootstrapAttachment.detach("WebRTC bootstrap consumer closed");
      if (!attachment) {
        sink.close();
      }
    };
    this.active.set(options.sessionId, close);

    bridge.stderr.setEncoding("utf8");
    bridge.stderr.on("data", (chunk: string) => {
      for (const line of chunk.split(/\r?\n/)) {
        if (line.trim()) {
          this.logger.debug(`[webrtc:${options.sessionId}] ${line}`);
        }
      }
    });

    bridge.once("close", (code, signal) => {
      clearInterval(queueMetricsTimer);
      if (this.active.get(options.sessionId) === close) {
        this.active.delete(options.sessionId);
      }
      this.logger.debug(
        `[webrtc:${options.sessionId}] bridge closed code=${code ?? 0}${signal ? ` signal=${signal}` : ""}`,
      );
    });

    let answer: { sdp: string };
    try {
      answer = await this.configureBridge({
        bridge,
        sessionId: options.sessionId,
        offerSdp: options.sdp,
        iceHost,
        maxFps: this.number(options.maxFps, DEFAULT_MAX_FPS, 1, 120),
        audio: options.audio,
        h264FmtpLine: bootstrap.sdpFmtpLine,
        h264ProfileLevelId: bootstrap.profileLevelId,
      });
    } catch (error) {
      if (this.active.get(options.sessionId) === close) {
        this.active.delete(options.sessionId);
      }
      close();
      throw error;
    }

    try {
      attachment = this.scrcpy.attachStream({
        ...sourceOptions,
        sink,
      });
      bootstrapAttachment.detach("WebRTC bridge attached");
      sink.sendStatus({
        type: "webrtc-profile",
        profileLevelId: bootstrap.profileLevelId,
        sdpFmtpLine: bootstrap.sdpFmtpLine,
        width: bootstrap.width,
        height: bootstrap.height,
        actualEncoder: bootstrap.actualEncoder,
        declaredLevelSupportsRequestedRate,
      });
      void attachment.closed.then(() => {
        if (bridge.exitCode === null && !bridge.killed) {
          bridge.kill("SIGTERM");
        }
      });
    } catch (error) {
      this.logger.warn(
        `[webrtc:${options.sessionId}] scrcpy stream failed: ${this.errorMessage(error)}`,
      );
      sink.close();
      bootstrapAttachment.detach("WebRTC bridge attach failed");
      if (this.active.get(options.sessionId) === close) {
        this.active.delete(options.sessionId);
      }
      throw error;
    }

    return {
      transport: "webrtc" as const,
      codec: "h264" as const,
      sdp: answer.sdp,
      iceServers: this.config.webrtcStunUrls,
      profileLevelId: bootstrap.profileLevelId,
    };
  }

  private sourceOptions(
    options: WebrtcOfferOptions,
    session: ReturnType<DisplaySessionService["assertStreamToken"]>,
  ): Omit<ScrcpyStreamOptions, "sink"> {
    return {
      sessionId: options.sessionId,
      udid: session.udid,
      codec: "h264",
      displayId: session.displayId,
      newDisplay: session.newDisplay,
      audio: options.audio,
      maxSize: this.nativeMaxSize(options.maxSize),
      maxFps: this.nativeFrameRate(options.maxFps),
      bitrate: this.number(
        options.bitrate,
        DEFAULT_BITRATE,
        100_000,
        100_000_000,
      ),
      iFrameInterval: INTERACTIVE_I_FRAME_INTERVAL,
      onActivity: () => this.sessions.touch(options.sessionId),
    };
  }

  private configureBridge({
    bridge,
    sessionId,
    offerSdp,
    iceHost,
    maxFps,
    audio,
    h264FmtpLine,
    h264ProfileLevelId,
  }: {
    bridge: ChildProcess;
    sessionId: string;
    offerSdp: string;
    iceHost: string;
    maxFps: number;
    audio: boolean;
    h264FmtpLine: string;
    h264ProfileLevelId: string;
  }) {
    return new Promise<{ sdp: string }>((resolve, reject) => {
      let settled = false;
      let buffer = "";
      const timeout = setTimeout(
        () => fail(new Error("Timed out creating WebRTC answer.")),
        10_000,
      );

      const cleanup = () => {
        clearTimeout(timeout);
        bridge.off("error", onError);
        bridge.off("close", onClose);
      };
      const fail = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        bridge.kill("SIGTERM");
        reject(error);
      };
      const onError = (error: Error) => fail(error);
      const onClose = () =>
        fail(new Error("WebRTC bridge exited before answering."));
      const onData = (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          this.handleBridgeLine(bridge, sessionId, line, (sdp) => {
            if (settled) {
              return;
            }
            settled = true;
            cleanup();
            resolve({ sdp });
          });
          newline = buffer.indexOf("\n");
        }
      };

      bridge.stdout?.on("data", onData);
      bridge.once("error", onError);
      bridge.once("close", onClose);
      bridge.stdin?.write(
        `${JSON.stringify({
          type: "offer",
          sdp: offerSdp,
          iceHost,
          udpPortRange: this.config.webrtcUdpPortRange,
          stunUrls: this.config.webrtcStunUrls,
          maxFps,
          audio,
          h264FmtpLine,
          h264ProfileLevelId,
        })}\n`,
      );
    });
  }

  private handleBridgeLine(
    bridge: ChildProcess,
    sessionId: string,
    line: string,
    onAnswer?: (sdp: string) => void,
  ) {
    if (!line) {
      return;
    }
    let message: BridgeMessage;
    try {
      message = JSON.parse(line) as BridgeMessage;
    } catch {
      this.logger.debug(`[webrtc:${sessionId}] ${line}`);
      return;
    }

    if (message.type === "answer") {
      onAnswer?.(message.sdp);
      return;
    }
    if (message.type === "control") {
      void this.handleControlMessage(sessionId, message.payload)
        .then((payload) => this.sendDataChannelMessage(bridge, payload))
        .catch((error) => {
          const failure = displayControlError(error);
          this.logger.warn(
            `[webrtc:${sessionId}] control message failed: ${failure.code}`,
          );
          this.sendDataChannelMessage(bridge, failure);
        });
      return;
    }
    if (message.type === "error") {
      this.logger.warn(`[webrtc:${sessionId}] ${message.message}`);
      return;
    }
    if (message.type === "metrics") {
      this.sendDataChannelMessage(bridge, {
        type: "webrtc-bridge-metrics",
        metrics: message.metrics,
      });
      return;
    }
    if (message.type === "video-resync-request") {
      this.scrcpy.requestVideoReset(
        sessionId,
        `webrtc:${message.message?.slice(0, 80) || "pli"}`,
      );
      return;
    }
    if (message.type === "log" || message.type === "state") {
      this.logger.debug(
        `[webrtc:${sessionId}] ${message.type === "state" ? message.state : message.message}`,
      );
    }
  }

  private async handleControlMessage(sessionId: string, payload: unknown) {
    const message = this.parseControlMessage(payload);
    if (!message) {
      return {
        ok: false as const,
        code: "invalid_control",
        message: "Invalid viewer control message.",
      };
    }
    return {
      id: message.id,
      ok: true as const,
      ...(await this.controls.execute(sessionId, message)),
    };
  }

  private sendDataChannelMessage(bridge: ChildProcess, payload: unknown) {
    bridge.stdin?.write(
      `${JSON.stringify({ type: "datachannel", payload })}\n`,
    );
  }

  private parseControlMessage(payload: unknown): DisplayControlRequest | null {
    if (!payload || typeof payload !== "object") {
      return null;
    }
    const record = payload as Record<string, unknown>;
    return typeof record.type === "string"
      ? (record as DisplayControlRequest)
      : null;
  }

  stopSession(sessionId: string) {
    this.active.get(sessionId)?.();
    this.active.delete(sessionId);
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

  private number(
    value: number | undefined,
    fallback: number,
    min: number,
    max: number,
  ) {
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? Math.min(Math.max(Math.round(parsed), min), max)
      : fallback;
  }

  private nativeMaxSize(value: number | undefined) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return DEFAULT_MAX_SIZE;
    }
    if (Math.round(parsed) === 0) {
      return 0;
    }
    throw new ConflictException(
      "Interactive display streaming requires native resolution (maxSize=0).",
    );
  }

  private nativeFrameRate(value: number | undefined) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return DEFAULT_MAX_FPS;
    }
    if (Math.round(parsed) === DEFAULT_MAX_FPS) {
      return DEFAULT_MAX_FPS;
    }
    throw new ConflictException(
      "Interactive display streaming requires maxFps=60.",
    );
  }

  private assertOfferSupportsBootstrap(
    offerSdp: string,
    bootstrap: ScrcpyVideoBootstrap,
  ): void {
    if (!findCompatibleH264Offer(offerSdp, bootstrap.profileLevelId)) {
      throw new ConflictException({
        code: "h264_profile_incompatible",
        message: `Browser does not offer H.264 packetization-mode=1 for source profile ${bootstrap.profileLevelId}.`,
        sourceProfileLevelId: bootstrap.profileLevelId,
      });
    }
  }

  private assertBootstrapHasDimensions(bootstrap: ScrcpyVideoBootstrap): void {
    if (!bootstrap.width || !bootstrap.height) {
      throw new ConflictException({
        code: "h264_dimensions_missing",
        message:
          "The H.264 encoder did not report exact native dimensions in its SPS.",
      });
    }
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private writeBridgeInput(input: Writable, payload: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      input.write(payload, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}
