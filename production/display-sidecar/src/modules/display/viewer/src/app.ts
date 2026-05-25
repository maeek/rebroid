import { getViewerElements, readViewerConfig } from "./config";
import { createControlChannel } from "./control-channel";
import { createDisplayStream } from "./display-stream";
import { createH264Decoder } from "./h264-decoder";
import { createPageLifecycle } from "./page-lifecycle";
import { setupTouchInput } from "./touch-input";
import { createViewerUi } from "./ui";

const config = readViewerConfig();
const elements = getViewerElements();
const ui = createViewerUi(elements);
const lifecycle = createPageLifecycle();
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
});

setupTouchInput({
  canvas: elements.canvas,
  controlChannel,
});

controlChannel.connect();
displayStream.connect().catch(() => displayStream.scheduleReconnect());
