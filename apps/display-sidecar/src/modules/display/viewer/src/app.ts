import { getViewerElements, readViewerConfig } from "./config.js";
import { createControlChannel } from "./control-channel.js";
import { createDisplayStream } from "./display-stream.js";
import { createPageLifecycle } from "./page-lifecycle.js";
import { setupTouchInput } from "./touch-input.js";
import {
  emitViewerStreamStatus,
  statusFromCompatibility,
} from "./stream-status.js";
import { createViewerUi } from "./ui.js";
import { createWebrtcStream } from "./webrtc-stream.js";
import type { DisplayTransport, ViewerRelayMetrics } from "./types.js";

const config = readViewerConfig();
const elements = getViewerElements();
const ui = createViewerUi(elements);
const lifecycle = createPageLifecycle();
let activeTransport = config.transport;
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
    const metrics = message.metrics as Record<string, unknown>;
    const sourceFps = Number(metrics.sourceFps);
    const droppedFrames = Number(metrics.droppedFrames);
    const queueDepthMs = Number(metrics.queueDepthMs);
    if ([sourceFps, droppedFrames, queueDepthMs].every(Number.isFinite)) {
      const optionalNumber = (key: string) => {
        const value = Number(metrics[key]);
        return Number.isFinite(value) ? value : undefined;
      };
      latestRelayMetrics = {
        sourceFps,
        droppedFrames,
        queueDepthMs,
        sourceBitrateMbps: optionalNumber("sourceBitrateMbps"),
        sourceFrameSizeP95Bytes: optionalNumber("sourceFrameSizeP95Bytes"),
        keyFrameSizeBytes: optionalNumber("keyFrameSizeBytes"),
        sourceInterFrameP95Ms: optionalNumber("sourceInterFrameP95Ms"),
        relayP95Ms: optionalNumber("relayP95Ms"),
        relayP99Ms: optionalNumber("relayP99Ms"),
        eventLoopUtilization: optionalNumber("eventLoopUtilization"),
        gcPauseP95Ms: optionalNumber("gcPauseP95Ms"),
        bridgeNackCount: latestRelayMetrics?.bridgeNackCount,
        bridgePliCount: latestRelayMetrics?.bridgePliCount,
        bridgePacketsLost: latestRelayMetrics?.bridgePacketsLost,
        bridgeRoundTripTimeMs: latestRelayMetrics?.bridgeRoundTripTimeMs,
        retransmittedPackets: latestRelayMetrics?.retransmittedPackets,
        retransmittedBytes: latestRelayMetrics?.retransmittedBytes,
        packetsDiscardedOnSend: latestRelayMetrics?.packetsDiscardedOnSend,
        rtpSendDelayMs: latestRelayMetrics?.rtpSendDelayMs,
        bridgeInputFps: latestRelayMetrics?.bridgeInputFps,
        rtpSentFps: latestRelayMetrics?.rtpSentFps,
        rtpPacketizationP95Ms: latestRelayMetrics?.rtpPacketizationP95Ms,
        rtpWriteP95Ms: latestRelayMetrics?.rtpWriteP95Ms,
        rtpSendErrors: latestRelayMetrics?.rtpSendErrors,
        actualEncoder: latestRelayMetrics?.actualEncoder,
        width: latestRelayMetrics?.width,
        height: latestRelayMetrics?.height,
        h264ProfileLevelId: latestRelayMetrics?.h264ProfileLevelId,
        negotiatedH264ProfileLevelId:
          latestRelayMetrics?.negotiatedH264ProfileLevelId,
        sourceAttemptId: latestRelayMetrics?.sourceAttemptId,
      };
    }
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
    ui.showCompatibility(
      typeof message.mode === "string" ? message.mode : "normal",
      typeof message.message === "string" ? message.message : undefined,
    );
    return;
  }
  if (message.type === "audio-disabled") {
    emitAudioDisabled("Audio capture is disabled for this stream.");
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
  token: config.token,
  lifecycle,
  onMessage: handleSidecarMessage,
});
const displayStream: DisplayTransport = createDisplayStream({
  config,
  ui,
  lifecycle,
});
const startWebsocket = () => {
  activeTransport = "websocket";
  controlChannel.connect();
  setupTouchInput({
    target: elements.canvas,
    getVideoSize: () => ({
      width: elements.canvas.width,
      height: elements.canvas.height,
    }),
    controlChannel,
  });
  displayStream.connect().catch(() => displayStream.scheduleReconnect());
};

const webrtcStream = createWebrtcStream({
  config,
  video: elements.video,
  controlChannel,
  ui,
  lifecycle,
  getRelayMetrics: () => latestRelayMetrics,
});

setupTouchInput({
  target: elements.video,
  getVideoSize: () => ({
    width: elements.video.videoWidth,
    height: elements.video.videoHeight,
  }),
  controlChannel,
});

if (config.transport === "websocket") {
  startWebsocket();
} else {
  webrtcStream.connect().catch(() => webrtcStream.scheduleReconnect());
}
