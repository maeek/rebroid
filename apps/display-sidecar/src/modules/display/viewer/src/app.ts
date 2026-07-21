import { getViewerElements, readViewerConfig } from "./config.js";
import { createViewerAudioPlayer } from "./audio-player.js";
import { createControlChannel } from "./control-channel.js";
import { createDisplayStream } from "./display-stream.js";
import { createH264Decoder } from "./h264-decoder.js";
import { createPageLifecycle } from "./page-lifecycle.js";
import { setupTouchInput } from "./touch-input.js";
import { createStreamMetricsReporter } from "./stream-metrics.js";
import {
  emitViewerStreamStatus,
  statusFromCompatibility,
} from "./stream-status.js";
import { createViewerUi } from "./ui.js";
import { createWebrtcStream } from "./webrtc-stream.js";
import type { DisplayTransport } from "./types.js";

const config = readViewerConfig();
const elements = getViewerElements();
const ui = createViewerUi(elements);
const lifecycle = createPageLifecycle();
let activeTransport = config.transport;
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
const audioPlayer = createViewerAudioPlayer({
  onDisabled: emitAudioDisabled,
});
const handleSidecarMessage = (message: Record<string, unknown>) => {
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
    audioPlayer.disable("Audio capture is disabled for this stream.");
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
let displayStream: DisplayTransport | null = null;
const websocketMetricsReporter = createStreamMetricsReporter({
  transport: "websocket",
  getSize: () => ({
    width: elements.canvas.width,
    height: elements.canvas.height,
  }),
});
const decoder = createH264Decoder({
  canvas: elements.canvas,
  context: elements.context,
  ui,
  onFrame: websocketMetricsReporter.addFrame,
  onStall: () => displayStream?.scheduleReconnect(),
});
displayStream = createDisplayStream({
  config,
  decoder,
  ui,
  lifecycle,
  audioPlayer,
  metricsReporter: websocketMetricsReporter,
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
  displayStream?.connect().catch(() => displayStream?.scheduleReconnect());
};

const webrtcStream = createWebrtcStream({
  config,
  video: elements.video,
  controlChannel,
  ui,
  lifecycle,
  fallback: startWebsocket,
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
