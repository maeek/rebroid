import type { ViewerConfig, ViewerElements } from "./types";

export const keyboardEventMessageType = "rebroid-viewer-keyboard-event";
export const keyboardCaptureMessageType = "rebroid-viewer-keyboard-capture";
export const viewerControlMessageType = "rebroid-viewer-control-event";
export const viewerStreamStatusMessageType = "rebroid-viewer-stream-status";
export const viewerStreamMetricsMessageType = "rebroid-viewer-stream-metrics";
const websocketFallbackTtlMs = 2 * 60_000;
const websocketFallbackKeyPrefix = "rebroid.display.websocket-fallback.";

function websocketFallbackKey(sessionId: string) {
  return `${websocketFallbackKeyPrefix}${sessionId}`;
}

export function rememberWebsocketFallback(sessionId: string | null): void {
  if (!sessionId) {
    return;
  }

  try {
    sessionStorage.setItem(
      websocketFallbackKey(sessionId),
      String(Date.now() + websocketFallbackTtlMs),
    );
  } catch {
    // Session storage may be unavailable in hardened browser modes.
  }
}

function hasWebsocketFallback(sessionId: string | null): boolean {
  if (!sessionId) {
    return false;
  }

  try {
    const key = websocketFallbackKey(sessionId);
    const expiresAt = Number(sessionStorage.getItem(key));
    if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
      return true;
    }
    sessionStorage.removeItem(key);
  } catch {
    return false;
  }

  return false;
}

export function readViewerConfig(): ViewerConfig {
  const params = new URLSearchParams(location.search);
  const sessionId = params.get("sessionId");
  const requestedTransport =
    params.get("transport") === "websocket" ? "websocket" : "webrtc";
  return {
    params,
    sessionId,
    token: params.get("token"),
    transport:
      requestedTransport === "websocket" || hasWebsocketFallback(sessionId)
        ? "websocket"
        : "webrtc",
    audio: params.get("audio") === "1",
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
  const video = document.getElementById("screen-video");
  if (!(video instanceof HTMLVideoElement)) {
    throw new Error("Viewer video element is missing.");
  }

  return {
    title: document.getElementById("message-title"),
    copy: document.getElementById("message-copy"),
    status: document.getElementById("status"),
    compatibility: document.getElementById("compatibility"),
    message: document.getElementById("message"),
    canvas,
    context,
    video,
  };
}
