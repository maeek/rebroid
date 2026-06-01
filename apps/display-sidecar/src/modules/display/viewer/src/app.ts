import { getViewerElements, readViewerConfig } from "./config";
import { createViewerAudioPlayer } from "./audio-player";
import { createControlChannel } from "./control-channel";
import { createDisplayStream } from "./display-stream";
import { createH264Decoder } from "./h264-decoder";
import { createPageLifecycle } from "./page-lifecycle";
import { setupTouchInput } from "./touch-input";
import { createViewerUi } from "./ui";
import { createWebrtcStream } from "./webrtc-stream";

const config = readViewerConfig();
const elements = getViewerElements();
const ui = createViewerUi(elements);
const lifecycle = createPageLifecycle();
const audioPlayer = createViewerAudioPlayer();
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
});
const decoder = createH264Decoder({
  canvas: elements.canvas,
  context: elements.context,
  ui,
});
const displayStream = createDisplayStream({
  config,
  decoder,
  ui,
  lifecycle,
  audioPlayer,
});
const startWebsocket = () => {
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
