import { randomUUID } from "node:crypto";
import {
  ConflictException,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ScrcpyBootstrapSink } from "../scrcpy/scrcpy-bootstrap-sink";
import { supportsH264PixelRate } from "../scrcpy/scrcpy-h264-profile";
import { QueuedScrcpyMediaSink } from "../scrcpy/scrcpy-media-sink";
import { scrcpyVideoConfigurationChangedCloseCode } from "../scrcpy/scrcpy.types";
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
const codecChangeDeliveryMs = 500;

type WebrtcTerminationReason =
  | "access_revoked"
  | "offer_abandoned"
  | "viewer_replaced"
  | "display_session_closed"
  | "sidecar_shutdown"
  | "offer_cancelled"
  | "source_bootstrap_failed"
  | "source_codec_incompatible"
  | "bridge_start_failed"
  | "bridge_connection_closed"
  | "bridge_input_closed"
  | "signaling_failed"
  | "peer_connect_timeout"
  | "source_codec_changed"
  | "source_attach_failed"
  | "source_profile_changed"
  | "media_keyframe_timeout"
  | "media_consumer_closed";

function mediaTerminationReason(
  code?: number,
  reason?: string,
): WebrtcTerminationReason {
  switch (code) {
    case scrcpyVideoConfigurationChangedCloseCode:
      return "source_codec_changed";
    case 1012:
      return "source_profile_changed";
    case 4404:
      return "display_session_closed";
    case 1001:
      return "sidecar_shutdown";
  }
  if (
    reason &&
    /^RBD1 video PTS advanced for more than \d+ ms without a keyframe$/.test(
      reason,
    )
  ) {
    return "media_keyframe_timeout";
  }
  return "media_consumer_closed";
}

interface WebrtcAttemptOptions {
  sessionId: string;
  sdp: string;
  iceHost: string;
  maxFps: number;
  audio: boolean;
  allowClipboard: boolean;
  iceServers: string[];
  attachSource: (sink: ScrcpyMediaSink) => ScrcpyStreamAttachment;
  launchBridge: (
    signal: AbortSignal,
    attemptId: string,
  ) => WebrtcBridge | Promise<WebrtcBridge>;
  executeControl: (
    request: DisplayControlRequest,
  ) => ReturnType<DisplayControlService["execute"]>;
  onFinish: () => void;
}

export class DisplayWebrtcAttempt {
  private readonly logger = new Logger(DisplayWebrtcAttempt.name);
  private readonly controller = new AbortController();
  private readonly attemptId = randomUUID();
  private failureStage: WebrtcTerminationReason = "source_bootstrap_failed";
  private firstTerminationReason?: WebrtcTerminationReason;
  private sourceAttemptId?: string;

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
      signal.throwIfAborted();
      bootstrapAttachment = this.options.attachSource(
        new ScrcpyBootstrapSink(),
      );
      this.sourceAttemptId = bootstrapAttachment.sourceAttemptId;
      const bootstrap = await awaitAttempt(
        bootstrapAttachment.awaitVideoBootstrap(3_000),
        signal,
      );
      signal.throwIfAborted();
      this.failureStage = "source_codec_incompatible";
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
          `[webrtc:${sessionId}:${this.attemptId}] encoder SPS ${bootstrap.profileLevelId} declares a lower macroblock rate than ${bootstrap.width}x${bootstrap.height}@${maxFps}; continuing because scrcpy max_fps is a variable-frame-rate cap`,
        );
      }
      return await this.negotiate(
        bootstrap,
        detachBootstrap,
        declaredLevelSupportsRequestedRate,
      );
    } catch (error) {
      this.stop(error, this.failureStage);
      throw error;
    }
  }

  stop(
    reason: unknown = new ConflictException("WebRTC offer was cancelled."),
    code: WebrtcTerminationReason = "offer_cancelled",
  ) {
    if (this.controller.signal.aborted) return;
    // A media sink can initiate shutdown before the closing IPC socket reports it.
    const first = this.firstTerminationReason ?? code;
    const source = this.sourceAttemptId
      ? ` sourceAttemptId=${this.sourceAttemptId}`
      : "";
    this.logger.debug(
      `[webrtc:${this.options.sessionId}:${this.attemptId}] attempt ended reason=${first}${source}`,
    );
    this.options.onFinish();
    this.controller.abort(reason);
  }

  private async negotiate(
    bootstrap: ScrcpyVideoBootstrap,
    detachBootstrap: () => void,
    declaredLevelSupportsRequestedRate: boolean,
  ) {
    const { signal } = this.controller;
    const { sessionId, audio, iceHost, maxFps, iceServers, sdp } = this.options;
    signal.throwIfAborted();
    this.failureStage = "bridge_start_failed";
    const bridge = await this.options.launchBridge(signal, this.attemptId);
    this.failureStage = "signaling_failed";
    if (signal.aborted) {
      bridge.close();
      signal.throwIfAborted();
    }
    let codecChangeTimer: NodeJS.Timeout | undefined;
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
      close: (code, reason) => {
        if (!signal.aborted) {
          this.firstTerminationReason ??= mediaTerminationReason(code, reason);
        }
        if (
          code === scrcpyVideoConfigurationChangedCloseCode &&
          !signal.aborted
        ) {
          // The old media sink is already closed. Give its reliable channel
          // time to deliver the notice before closing the peer as a fallback.
          codecChangeTimer = setTimeout(
            () => bridge.close(),
            codecChangeDeliveryMs,
          );
          codecChangeTimer.unref();
          try {
            bridge.sendDataChannel({
              type: "webrtc-codec-changed",
              consumerAttemptId: this.attemptId,
            });
          } catch {
            bridge.close();
          }
          return;
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
        clearTimeout(codecChangeTimer);
        attachment?.detach("WebRTC consumer closed");
        sink.close();
        if (codecChangeTimer && bridge.isOpen()) bridge.close();
      },
      { once: true },
    );
    bridge.onClose(() => {
      this.stop(
        new ServiceUnavailableException("WebRTC bridge connection closed."),
        "bridge_connection_closed",
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
        this.sourceAttemptId = attachment.sourceAttemptId;
        detachBootstrap();
        this.logger.debug(
          `[webrtc:${sessionId}:${this.attemptId}] media attached sourceAttemptId=${attachment.sourceAttemptId} consumerId=${attachment.consumerId}`,
        );
        sink.sendStatus({
          type: "webrtc-profile",
          consumerAttemptId: this.attemptId,
          sourceAttemptId: attachment.sourceAttemptId,
          profileLevelId: bootstrap.profileLevelId,
          sdpFmtpLine: bootstrap.sdpFmtpLine,
          width: bootstrap.width,
          height: bootstrap.height,
          actualEncoder: bootstrap.actualEncoder,
          declaredLevelSupportsRequestedRate,
        });
        void attachment.closed.then(() => {
          if (!codecChangeTimer) this.stop(undefined, "media_consumer_closed");
        });
      } catch (error) {
        this.stop(error, "source_attach_failed");
      }
    };

    const offer: WebrtcBridgeOffer = {
      type: "offer",
      sdp,
      iceHost,
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
          onFailure: () =>
            this.stop(
              new ServiceUnavailableException("WebRTC bridge input closed."),
              "bridge_input_closed",
            ),
          onAudioFailure: () => disableAudio(),
          onLog: (message) =>
            this.logger.debug(
              `[webrtc:${sessionId}:${this.attemptId}] ${message}`,
            ),
          onMessage: (message) => {
            if (signal.aborted) return;
            if (codecChangeTimer) {
              // The peer remains open briefly for the outbound notice alone.
              return;
            }
            switch (message.type) {
              case "answer":
                resolve(message.sdp);
                break;
              case "state":
                this.logger.debug(
                  `[webrtc:${sessionId}:${this.attemptId}] ${message.state}`,
                );
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
      this.failureStage = "source_codec_changed";
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
        "peer_connect_timeout",
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
      consumerAttemptId: this.attemptId,
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
          `[webrtc:${this.options.sessionId}:${this.attemptId}] ${message.message}`,
        );
        break;
      case "log":
        this.logger.debug(
          `[webrtc:${this.options.sessionId}:${this.attemptId}] ${message.message}`,
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
