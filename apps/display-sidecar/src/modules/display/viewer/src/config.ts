import type {
  ViewerConfig,
  ViewerEffectiveProfile,
  ViewerElements,
} from "./types.js";

export const keyboardEventMessageType = "rebroid-viewer-keyboard-event";
export const keyboardCaptureMessageType = "rebroid-viewer-keyboard-capture";
export const viewerControlMessageType = "rebroid-viewer-control-event";
export const viewerStreamStatusMessageType = "rebroid-viewer-stream-status";
export const viewerStreamMetricsMessageType =
  "rebroid-viewer-stream-metrics-v4";

export function readViewerConfig(): ViewerConfig {
  const params = new URLSearchParams(location.search);
  const sessionId = params.get("sessionId");
  return {
    params,
    sessionId,
    token: params.get("token"),
    transport: params.get("transport") === "websocket" ? "websocket" : "webrtc",
    audio: params.get("audio") === "1",
    streamDefaults: {
      codec: "h264",
      maxSize: "0",
      maxFps: "60",
      bitrate: "16000000",
      iFrameInterval: "1",
    },
  };
}

export function configuredStreamProfile(
  config: ViewerConfig,
  transport: ViewerEffectiveProfile["transport"],
): ViewerEffectiveProfile {
  const value = (name: string) =>
    config.params.get(name) ?? config.streamDefaults[name] ?? "0";
  return {
    transport,
    codec: value("codec"),
    maxSize: Number(value("maxSize")),
    maxFps: Number(value("maxFps")),
    bitrate: Number(value("bitrate")),
    iFrameInterval: Number(value("iFrameInterval")),
    audio: config.audio,
  };
}

export function getViewerElements(): ViewerElements {
  const canvas = document.getElementById("screen");
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("Viewer canvas is missing.");
  }

  const video = document.getElementById("screen-video");
  if (!(video instanceof HTMLVideoElement)) {
    throw new Error("Viewer video element is missing.");
  }

  const snapshot = document.getElementById("screen-snapshot");
  if (!(snapshot instanceof HTMLCanvasElement)) {
    throw new Error("Viewer snapshot canvas is missing.");
  }

  return {
    title: document.getElementById("message-title"),
    copy: document.getElementById("message-copy"),
    status: document.getElementById("status"),
    compatibility: document.getElementById("compatibility"),
    message: document.getElementById("message"),
    canvas,
    snapshot,
    video,
  };
}
