import {
  ConflictException,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ScrcpyBootstrapSink } from "../scrcpy/scrcpy-bootstrap-sink";
import { supportsH264PixelRate } from "../scrcpy/scrcpy-h264-profile";
import { QueuedScrcpyMediaSink } from "../scrcpy/scrcpy-media-sink";
import type {
  ScrcpyMediaSink,
  ScrcpyStreamAttachment,
  ScrcpyVideoBootstrap,
} from "../scrcpy/scrcpy.types";
import type { DisplayControlService } from "./display-control.service";
import { displayControlError } from "./display-control-response";
import type { DisplayControlRequest } from "./display.types";
import type {
  WebrtcBridge,
  WebrtcBridgeMessage,
  WebrtcBridgeOffer,
} from "./display-webrtc-bridge";
import { findCompatibleH264Offer } from "./display-webrtc-codec";

const connectTimeoutMs = 15_000;

interface WebrtcAttemptOptions {
  sessionId: string;
  sdp: string;
  iceHost: string;
  maxFps: number;
  audio: boolean;
  allowClipboard: boolean;
  iceServers: string[];
  udpPortRange: string;
  assertSourceSupported: () => Promise<void>;
  attachSource: (sink: ScrcpyMediaSink) => ScrcpyStreamAttachment;
  launchBridge: () => WebrtcBridge;
  executeControl: (
    request: DisplayControlRequest,
  ) => ReturnType<DisplayControlService["execute"]>;
  onFinish: () => void;
}

export class DisplayWebrtcAttempt {
  private readonly logger = new Logger(DisplayWebrtcAttempt.name);
  private readonly controller = new AbortController();

  constructor(private readonly options: WebrtcAttemptOptions) {}

  async run() {
    const { signal } = this.controller;
    const { sessionId, sdp, maxFps } = this.options;
    let bootstrapAttachment: ScrcpyStreamAttachment | undefined;
    const detachBootstrap = () => {
      signal.removeEventListener("abort", detachBootstrap);
      const attachment = bootstrapAttachment;
      bootstrapAttachment = undefined;
      attachment?.detach("WebRTC bootstrap finished");
    };
    signal.addEventListener("abort", detachBootstrap, { once: true });

    try {
      await awaitAttempt(this.options.assertSourceSupported(), signal);
      signal.throwIfAborted();
      bootstrapAttachment = this.options.attachSource(
        new ScrcpyBootstrapSink(),
      );
      const bootstrap = await awaitAttempt(
        bootstrapAttachment.awaitVideoBootstrap(3_000),
        signal,
      );
      signal.throwIfAborted();
      this.assertBootstrapHasDimensions(bootstrap);
      this.assertOfferSupportsBootstrap(sdp, bootstrap);
      const declaredLevelSupportsRequestedRate = supportsH264PixelRate(
        bootstrap.profileLevelId,
        bootstrap.width!,
        bootstrap.height!,
        maxFps,
      );
      if (!declaredLevelSupportsRequestedRate) {
        this.logger.warn(
          `[webrtc:${sessionId}] encoder SPS ${bootstrap.profileLevelId} declares a lower macroblock rate than ${bootstrap.width}x${bootstrap.height}@${maxFps}; continuing because scrcpy max_fps is a variable-frame-rate cap`,
        );
      }
      return await this.negotiate(
        bootstrap,
        detachBootstrap,
        declaredLevelSupportsRequestedRate,
      );
    } catch (error) {
      this.stop(error);
      throw error;
    }
  }

  stop(reason: unknown = new ConflictException("WebRTC offer was cancelled.")) {
    if (this.controller.signal.aborted) return;
    this.options.onFinish();
    this.controller.abort(reason);
  }

  private async negotiate(
    bootstrap: ScrcpyVideoBootstrap,
    detachBootstrap: () => void,
    declaredLevelSupportsRequestedRate: boolean,
  ) {
    const { signal } = this.controller;
    const { sessionId, audio, iceHost, maxFps, udpPortRange, iceServers, sdp } =
      this.options;
    signal.throwIfAborted();
    const bridge = this.options.launchBridge();
    let mediaCloseReason: string | undefined;
    let audioDisabled = !audio;
    const disableAudio = (message = "Audio relay stopped.") => {
      if (audioDisabled || signal.aborted) return;
      audioDisabled = true;
      bridge.stopAudio();
      sink.sendStatus({ type: "audio-disabled", message });
    };
    const sink = new QueuedScrcpyMediaSink({
      allowClipboard: this.options.allowClipboard,
      isOpen: () => bridge.isOpen(),
      onClose: (listener) => bridge.onClose(listener),
      writeStatus: (payload) => bridge.sendDataChannel(JSON.parse(payload)),
      writeVideo: (payload) => bridge.writeVideo(payload),
      writeAudio: async (payload) => {
        if (audioDisabled) return;
        try {
          await bridge.writeAudio(payload);
        } catch {
          disableAudio();
        }
      },
      close: (_code, reason) => {
        if (reason && !signal.aborted) {
          mediaCloseReason = reason.slice(0, 120);
        }
        bridge.close();
      },
    });
    let attachment: ScrcpyStreamAttachment | null = null;
    let connectTimer: NodeJS.Timeout | undefined;
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
          sourceVideoFrames: snapshot.sourceVideoFrames,
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
    signal.addEventListener(
      "abort",
      () => {
        clearInterval(queueMetricsTimer);
        clearTimeout(connectTimer);
        attachment?.detach("WebRTC consumer closed");
        sink.close();
      },
      { once: true },
    );
    bridge.onClose((code, reason) => {
      this.stop(new ServiceUnavailableException("WebRTC bridge exited."));
      const media = mediaCloseReason
        ? ` mediaReason=${JSON.stringify(mediaCloseReason)}`
        : "";
      this.logger.debug(
        `[webrtc:${sessionId}] bridge closed code=${code ?? 0}${reason ? ` signal=${reason.toString()}` : ""}${media}`,
      );
    });

    let answerReady = false;
    let connected = false;
    const attachMedia = () => {
      if (!answerReady || !connected || signal.aborted || attachment) return;
      clearTimeout(connectTimer);
      try {
        attachment = bootstrap.attachMedia(sink);
        if (!attachment) {
          throw new ServiceUnavailableException(
            "The video codec generation changed before WebRTC connected.",
          );
        }
        detachBootstrap();
        sink.sendStatus({
          type: "webrtc-profile",
          profileLevelId: bootstrap.profileLevelId,
          sdpFmtpLine: bootstrap.sdpFmtpLine,
          width: bootstrap.width,
          height: bootstrap.height,
          actualEncoder: bootstrap.actualEncoder,
          declaredLevelSupportsRequestedRate,
        });
        void attachment.closed.then(() => this.stop());
      } catch (error) {
        this.logger.warn(
          `[webrtc:${sessionId}] scrcpy stream failed: ${this.errorMessage(error)}`,
        );
        this.stop(error);
      }
    };

    const offer: WebrtcBridgeOffer = {
      type: "offer",
      sdp,
      iceHost,
      udpPortRange,
      stunUrls: iceServers,
      maxFps,
      audio,
      h264FmtpLine: bootstrap.sdpFmtpLine,
      h264ProfileLevelId: bootstrap.profileLevelId,
    };
    let answerTimeout: NodeJS.Timeout | undefined;
    const answer = await awaitAttempt(
      new Promise<string>((resolve, reject) => {
        answerTimeout = setTimeout(
          () => reject(new Error("Timed out creating WebRTC answer.")),
          10_000,
        );
        bridge.listen({
          signal,
          onFailure: (error, source) =>
            this.stop(
              source === "input"
                ? new ServiceUnavailableException("WebRTC bridge input closed.")
                : error,
            ),
          onAudioFailure: () => disableAudio(),
          onLog: (message) =>
            this.logger.debug(`[webrtc:${sessionId}] ${message}`),
          onMessage: (message) => {
            if (signal.aborted) return;
            switch (message.type) {
              case "answer":
                resolve(message.sdp);
                break;
              case "state":
                this.logger.debug(`[webrtc:${sessionId}] ${message.state}`);
                if (message.state === "connected") {
                  connected = true;
                  attachMedia();
                }
                break;
              case "video-resync-request":
                attachment?.requestVideoReset(
                  `webrtc:${message.message?.slice(0, 80) || "pli"}`,
                );
                break;
              case "audio-disabled":
                disableAudio(message.message);
                break;
              default:
                this.handleBridgeMessage(bridge, message);
            }
          },
        });
        bridge.sendOffer(offer);
      }),
      signal,
    ).finally(() => clearTimeout(answerTimeout));
    signal.throwIfAborted();

    if (!bootstrap.isCurrent()) {
      throw new ServiceUnavailableException(
        "The video codec generation changed during WebRTC negotiation.",
      );
    }
    // The answer must reach the browser before its SRTP transport can accept
    // the cached GOP. Keep the bootstrap consumer alive across that gap.
    answerReady = true;
    connectTimer = setTimeout(() => {
      this.stop(
        new ServiceUnavailableException("WebRTC peer did not connect."),
      );
    }, connectTimeoutMs);
    connectTimer.unref();
    attachMedia();
    signal.throwIfAborted();

    return {
      transport: "webrtc" as const,
      codec: "h264" as const,
      sdp: answer,
      iceServers,
      profileLevelId: bootstrap.profileLevelId,
    };
  }

  private handleBridgeMessage(
    bridge: WebrtcBridge,
    message: Exclude<
      WebrtcBridgeMessage,
      { type: "answer" | "state" | "video-resync-request" | "audio-disabled" }
    >,
  ) {
    switch (message.type) {
      case "control":
        void this.handleControlMessage(message.payload).then((payload) => {
          if (!this.controller.signal.aborted) bridge.sendDataChannel(payload);
        });
        break;
      case "pointer-move": {
        const pointer = this.parseControlMessage(message.payload);
        if (
          pointer?.type === "touch" &&
          pointer.action === "pointer" &&
          pointer.eventType === "move"
        ) {
          void this.options.executeControl(pointer).catch(() => undefined);
        }
        break;
      }
      case "metrics":
        bridge.sendDataChannel({
          type: "webrtc-bridge-metrics",
          metrics: message.metrics,
        });
        break;
      case "error":
        this.logger.warn(
          `[webrtc:${this.options.sessionId}] ${message.message}`,
        );
        break;
      case "log":
        this.logger.debug(
          `[webrtc:${this.options.sessionId}] ${message.message}`,
        );
        break;
    }
  }

  private async handleControlMessage(payload: unknown) {
    const message = this.parseControlMessage(payload);
    if (!message) {
      return {
        ok: false as const,
        code: "invalid_control",
        message: "Invalid viewer control message.",
      };
    }
    const id =
      typeof message.id === "string" ? message.id.slice(0, 128) : undefined;
    try {
      return {
        id,
        ok: true as const,
        ...(await this.options.executeControl(message)),
      };
    } catch (error) {
      return { id, ...displayControlError(error) };
    }
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
}

async function awaitAttempt<T>(
  work: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  let onAbort: () => void;
  const cancelled = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([work, cancelled]);
  } finally {
    signal.removeEventListener("abort", onAbort!);
  }
}
