import { applyVideoRecoveryStatus } from "./video-recovery-metrics.js";
import { getViewerElements, readViewerConfig } from "./config.js";
import { createControlChannel } from "./control-channel.js";
import { createDisplayStream } from "./display-stream.js";
import { createPageLifecycle } from "./page-lifecycle.js";
import { applyControlRelayMetrics } from "./relay-metrics.js";
import { setupTouchInput } from "./touch-input.js";
import {
  emitViewerStreamStatus,
  statusFromCompatibility,
} from "./stream-status.js";
import { createViewerUi } from "./ui.js";
import { createViewerPresentation } from "./viewer-presentation.js";
import { createWebrtcStream } from "./webrtc-stream.js";
import type { ViewerRelayMetrics } from "./types.js";

const config = readViewerConfig();
const elements = getViewerElements();
const ui = createViewerUi(elements);
const lifecycle = createPageLifecycle(
  config.params.get("surfaceKind") !== "virtual",
);
const presentation = createViewerPresentation(lifecycle);
const activeTransport = config.transport;
let latestRelayMetrics: ViewerRelayMetrics | null = null;
const emitAudioDisabled = (
  message = "Audio capture is disabled for this stream.",
) => {
  emitViewerStreamStatus({
    code: "audio-disabled",
    severity: "info",
    blocking: false,
    message,
    transport: activeTransport,
  });
};
const handleSidecarMessage = (message: Record<string, unknown>) => {
  latestRelayMetrics = applyVideoRecoveryStatus(latestRelayMetrics, message);
  if (message.type === "video-reset" || message.type === "video-reset-complete")
    return;
  if (message.type === "ready" || message.type === "encoder") {
    latestRelayMetrics ??= {
      sourceFps: 0,
      droppedFrames: 0,
      queueDepthMs: 0,
    };
    const encoder = message.type === "encoder" ? message.name : message.encoder;
    if (typeof encoder === "string") {
      latestRelayMetrics.actualEncoder = encoder;
    }
    if (typeof message.sourceAttemptId === "string") {
      latestRelayMetrics.sourceAttemptId = message.sourceAttemptId;
    }
    return;
  }
  if (message.type === "relay-metrics" && message.metrics) {
    latestRelayMetrics = applyControlRelayMetrics(
      latestRelayMetrics,
      message.metrics as Record<string, unknown>,
    );
    return;
  }
  if (message.type === "webrtc-bridge-metrics" && message.metrics) {
    const metrics = message.metrics as Record<string, unknown>;
    const optionalNumber = (key: string) => {
      const value = Number(metrics[key]);
      return Number.isFinite(value) ? value : undefined;
    };
    latestRelayMetrics ??= {
      sourceFps: 0,
      droppedFrames: 0,
      queueDepthMs: 0,
    };
    latestRelayMetrics.bridgeNackCount = optionalNumber("nacks");
    latestRelayMetrics.bridgePliCount = optionalNumber("plis");
    latestRelayMetrics.bridgePacketsLost = optionalNumber("packetsLost");
    latestRelayMetrics.bridgeRoundTripTimeMs =
      optionalNumber("roundTripTimeMs");
    latestRelayMetrics.bridgeInputFps = optionalNumber("bridgeInputFps");
    latestRelayMetrics.rtpSentFps = optionalNumber("rtpSentFps");
    latestRelayMetrics.rtpPacketizationP95Ms =
      optionalNumber("packetizationP95Ms");
    latestRelayMetrics.rtpWriteP95Ms = optionalNumber("rtpWriteP95Ms");
    latestRelayMetrics.rtpSendErrors = optionalNumber("rtpSendErrors");
    latestRelayMetrics.retransmittedPackets = optionalNumber(
      "retransmittedPackets",
    );
    latestRelayMetrics.retransmittedBytes =
      optionalNumber("retransmittedBytes");
    latestRelayMetrics.packetsDiscardedOnSend = optionalNumber(
      "packetsDiscardedOnSend",
    );
    latestRelayMetrics.rtpSendDelayMs = optionalNumber("rtpSendDelayMs");
    return;
  }
  if (message.type === "webrtc-profile") {
    latestRelayMetrics ??= {
      sourceFps: 0,
      droppedFrames: 0,
      queueDepthMs: 0,
    };
    if (typeof message.consumerAttemptId === "string") {
      latestRelayMetrics.consumerAttemptId = message.consumerAttemptId;
    }
    if (typeof message.sourceAttemptId === "string") {
      latestRelayMetrics.sourceAttemptId = message.sourceAttemptId;
    }
    const width = Number(message.width);
    const height = Number(message.height);
    latestRelayMetrics.width = Number.isFinite(width) ? width : undefined;
    latestRelayMetrics.height = Number.isFinite(height) ? height : undefined;
    latestRelayMetrics.h264ProfileLevelId =
      typeof message.profileLevelId === "string"
        ? message.profileLevelId
        : undefined;
    latestRelayMetrics.actualEncoder =
      typeof message.actualEncoder === "string"
        ? message.actualEncoder
        : latestRelayMetrics.actualEncoder;
    return;
  }
  if (message.type === "compatibility") {
    const status = statusFromCompatibility({
      mode: message.mode,
      message: message.message,
      hasVisibleFrame: true,
      transport: activeTransport,
    });
    if (status) {
      emitViewerStreamStatus(status);
    }
    return;
  }
  if (message.type === "audio-disabled") {
    emitAudioDisabled(
      typeof message.message === "string" ? message.message : undefined,
    );
    return;
  }
  if (message.type === "reconnecting") {
    emitViewerStreamStatus({
      code: "reconnecting",
      severity: "info",
      blocking: false,
      message:
        typeof message.message === "string"
          ? message.message
          : "Reconnecting live display...",
      transport: activeTransport,
    });
  }
};
document.addEventListener(
  "contextmenu",
  (event) => {
    event.preventDefault();
  },
  { capture: true },
);
const controlChannel = createControlChannel({
  sessionId: config.sessionId,
  lifecycle,
  presentation,
  onMessage: handleSidecarMessage,
});
if (config.transport === "websocket") {
  const displayStream = createDisplayStream({
    config,
    ui,
    lifecycle,
    presentation,
  });
  controlChannel.connect();
  setupTouchInput({
    target: elements.canvas,
    getVideoSize: () => ({
      width: elements.canvas.width,
      height: elements.canvas.height,
    }),
    controlChannel,
    lifecycle,
    presentation,
  });
  displayStream.connect().catch(() => displayStream.scheduleReconnect());
} else {
  const webrtcStream = createWebrtcStream({
    config,
    video: elements.video,
    controlChannel,
    ui,
    lifecycle,
    presentation,
    getRelayMetrics: () => latestRelayMetrics,
  });
  webrtcStream.connect().catch(() => webrtcStream.scheduleReconnect());
}

setupTouchInput({
  target: elements.video,
  getVideoSize: () => ({
    width: elements.video.videoWidth,
    height: elements.video.videoHeight,
  }),
  controlChannel,
  lifecycle,
  presentation,
});
