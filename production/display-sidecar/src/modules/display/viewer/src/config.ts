import type { ViewerConfig, ViewerElements } from "./types";

export const keyboardEventMessageType = "rebroid-viewer-keyboard-event";
export const keyboardCaptureMessageType = "rebroid-viewer-keyboard-capture";
export const viewerControlMessageType = "rebroid-viewer-control-event";

export function readViewerConfig(): ViewerConfig {
  const params = new URLSearchParams(location.search);
  return {
    params,
    sessionId: params.get("sessionId"),
    token: params.get("token"),
    streamDefaults: {
      codec: "h264",
      maxSize: "1080",
      maxFps: "60",
      bitrate: "7000000",
      iFrameInterval: "1",
    },
  };
}

export function getViewerElements(): ViewerElements {
  const canvas = document.getElementById("screen");
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Viewer canvas is missing.");
  }

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new Error("Viewer canvas context is not available.");
  }

  return {
    title: document.getElementById("message-title"),
    copy: document.getElementById("message-copy"),
    status: document.getElementById("status"),
    message: document.getElementById("message"),
    canvas,
    context,
  };
}
