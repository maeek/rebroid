import type {
  DisplayDecoder,
  ViewerConfig,
  ViewerUi,
  PageLifecycle,
} from "./types";
import {
  parseViewerAudioPacket,
  type ViewerAudioPlayer,
} from "./audio-player";
import {
  emitViewerStreamStatus,
  statusFromCompatibility,
} from "./stream-status";

type DisplayStreamOptions = {
  config: ViewerConfig;
  decoder: DisplayDecoder;
  ui: ViewerUi;
  lifecycle: PageLifecycle;
  audioPlayer: ViewerAudioPlayer;
};

type StreamTextMessage = {
  type?: unknown;
  mode?: unknown;
  message?: unknown;
  diagnostic?: unknown;
  text?: unknown;
};

const firstFrameTimeoutMs = 8_000;
const streamHeartbeatTimeoutMs = 15_000;

function parseTextMessage(text: string): StreamTextMessage | null {
  try {
    const payload: unknown = JSON.parse(text);
    return payload && typeof payload === "object"
      ? (payload as StreamTextMessage)
      : null;
  } catch {
    return null;
  }
}

export function createDisplayStream({
  config,
  decoder,
  ui,
  lifecycle,
  audioPlayer,
}: DisplayStreamOptions) {
  let activeWs: WebSocket | null = null;
  let reconnectTimer = 0;
  let reconnectAttempt = 0;
  let streamGeneration = 0;
  let streamQueue: Promise<void> = Promise.resolve();
  let firstFrameTimer = 0;
  let heartbeatTimer = 0;
  let hasVisibleFrame = false;

  lifecycle.onClose(() => {
    clearStreamTimers();
    audioPlayer.reset();
    if (activeWs?.readyState === WebSocket.OPEN) {
      activeWs.close(1000, "viewer closed");
    }
  });

  function resetForReconnect() {
    clearStreamTimers();
    streamQueue = Promise.resolve();
    decoder.reset();
    audioPlayer.reset();
  }

  function clearStreamTimers() {
    if (firstFrameTimer) {
      window.clearTimeout(firstFrameTimer);
      firstFrameTimer = 0;
    }
    if (heartbeatTimer) {
      window.clearTimeout(heartbeatTimer);
      heartbeatTimer = 0;
    }
  }

  function forceReconnect(reason: string): void {
    if (lifecycle.isClosing()) {
      return;
    }
    console.warn(reason);
    emitViewerStreamStatus({
      code: hasVisibleFrame ? "video-stalled" : "first-frame-timeout",
      severity: hasVisibleFrame ? "warning" : "error",
      blocking: !hasVisibleFrame,
      message: reason,
      transport: "websocket",
    });
    if (
      activeWs?.readyState === WebSocket.OPEN ||
      activeWs?.readyState === WebSocket.CONNECTING
    ) {
      activeWs.close(4000, reason);
    }
    scheduleReconnect();
  }

  function armFirstFrameTimer(generation: number): void {
    if (firstFrameTimer || decoder.hasFrames()) {
      return;
    }
    firstFrameTimer = window.setTimeout(() => {
      firstFrameTimer = 0;
      if (generation !== streamGeneration || decoder.hasFrames()) {
        return;
      }
      if (!hasVisibleFrame) {
        console.warn("Display stream first-frame debug state.", {
          decoder: decoder.debugState(),
        });
        ui.showStatus(
          "Reconnecting...",
          "Starting live display",
          "Rebroid is opening the app screen.",
        );
      }
      forceReconnect("Display stream did not deliver a decodable first frame.");
    }, firstFrameTimeoutMs);
  }

  function markStreamAlive(generation: number): void {
    if (generation !== streamGeneration) {
      return;
    }
    if (heartbeatTimer) {
      window.clearTimeout(heartbeatTimer);
    }
    heartbeatTimer = window.setTimeout(() => {
      heartbeatTimer = 0;
      if (generation !== streamGeneration) {
        return;
      }
      forceReconnect("Display stream stopped sending heartbeats.");
    }, streamHeartbeatTimeoutMs);
  }

  function scheduleReconnect(event?: CloseEvent): void {
    if (lifecycle.isClosing() || reconnectTimer) {
      return;
    }

    const hadFrames = hasVisibleFrame || decoder.hasFrames();
    streamGeneration += 1;
    resetForReconnect();
    if (!hadFrames && reconnectAttempt >= 8) {
      console.warn("Display stream closed before video was decoded.", {
        code: event?.code,
        reason: event?.reason,
      });
      ui.showFailure("Refresh the viewer or restart the app.");
      return;
    }

    const delay = Math.min(300 * 2 ** reconnectAttempt, 2_500);
    reconnectAttempt += 1;
    if (!hadFrames) {
      ui.showStatus(
        "Reconnecting...",
        "Starting live display",
        "Rebroid is opening the app screen.",
      );
    } else {
      console.warn("Display stream closed; reconnecting.", {
        code: event?.code,
        reason: event?.reason,
      });
    }
    emitViewerStreamStatus({
      code: "reconnecting",
      severity: hadFrames ? "info" : "warning",
      blocking: !hadFrames,
      message: "Reconnecting live display...",
      transport: "websocket",
    });

    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = 0;
      connect().catch((error) => {
        console.warn("Could not reconnect display stream.", error);
        scheduleReconnect();
      });
    }, delay);
  }

  async function handleTextMessage(text: string): Promise<void> {
    const payload = parseTextMessage(text);
    if (!payload) {
      markStreamAlive(streamGeneration);
      if (!hasVisibleFrame && !decoder.hasFrames()) {
        ui.showStatus("Preparing live display...");
      }
      return;
    }

    markStreamAlive(streamGeneration);
    if (payload.type === "heartbeat") {
      return;
    }

    if (payload.type === "reconnecting") {
      const hadFrames = hasVisibleFrame || decoder.hasFrames();
      resetForReconnect();
      emitViewerStreamStatus({
        code: "reconnecting",
        severity: hadFrames ? "info" : "warning",
        blocking: !hadFrames,
        message:
          typeof payload.message === "string"
            ? payload.message
            : "Reconnecting live display...",
        transport: "websocket",
      });
      if (!hadFrames) {
        ui.showStatus(
          typeof payload.message === "string"
            ? payload.message
            : "Reconnecting live display...",
        );
      }
      return;
    }

    if (payload.type === "compatibility") {
      const status = statusFromCompatibility({
        mode: payload.mode,
        message: payload.message,
        diagnostic: payload.diagnostic,
        transport: "websocket",
        hasVisibleFrame: hasVisibleFrame || decoder.hasFrames(),
      });
      if (status) {
        emitViewerStreamStatus(status);
      }
      ui.showCompatibility(
        typeof payload.mode === "string" ? payload.mode : "normal",
        typeof payload.message === "string" ? payload.message : undefined,
      );
      if (
        status?.blocking &&
        !hasVisibleFrame &&
        typeof payload.diagnostic === "string"
      ) {
        ui.showStatus(payload.diagnostic.slice(0, 180));
      }
      return;
    }

    if (payload.type === "clipboard" && typeof payload.text === "string") {
      window.parent.postMessage(
        { type: "rebroid-viewer-clipboard", text: payload.text },
        window.location.origin,
      );
      if (navigator.clipboard && document.visibilityState === "visible") {
        await navigator.clipboard
          .writeText(payload.text)
          .catch(() => undefined);
      }
      return;
    }

    if (payload.type === "audio-disabled") {
      audioPlayer.disable("Audio capture is disabled for this stream.");
      return;
    }

    if (!hasVisibleFrame && !decoder.hasFrames()) {
      ui.showStatus(
        typeof payload.message === "string"
          ? payload.message
          : "Preparing live display...",
      );
    }
  }

  async function handleBinaryMessage(data: unknown): Promise<void> {
    if (data instanceof ArrayBuffer) {
      const bytes = new Uint8Array(data);
      markStreamAlive(streamGeneration);
      const audioPacket = parseViewerAudioPacket(bytes);
      if (audioPacket) {
        await audioPlayer.appendPacket(audioPacket);
        return;
      }
      await decoder.appendVideoPacket(bytes);
      return;
    }

    if (data instanceof Blob) {
      await handleBinaryMessage(await data.arrayBuffer());
    }
  }

  async function connect(): Promise<void> {
    if (!config.sessionId || !config.token) {
      ui.showFailure("Open the viewer again from the app page.");
      return;
    }

    if (!("VideoDecoder" in window) || !("EncodedVideoChunk" in window)) {
      ui.showFailure(
        "Open Rebroid over HTTPS in a compatible browser and try again.",
      );
      return;
    }

    const generation = ++streamGeneration;
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const streamParams = new URLSearchParams(location.search);
    streamParams.set("sessionId", config.sessionId);
    streamParams.set("token", config.token);
    for (const [key, value] of Object.entries(config.streamDefaults)) {
      if (!streamParams.has(key)) {
        streamParams.set(key, value);
      }
    }

    const ws = new WebSocket(
      `${protocol}//${location.host}/rebroid/display/stream?${streamParams.toString()}`,
    );
    activeWs = ws;
    ws.binaryType = "arraybuffer";

    ws.addEventListener("open", () => {
      if (generation !== streamGeneration) {
        return;
      }
      if (!hasVisibleFrame && !decoder.hasFrames()) {
        ui.showStatus(
          "Waiting for the first frame...",
          "Starting live display",
          "Rebroid is opening the app screen.",
        );
        armFirstFrameTimer(generation);
      } else {
        markStreamAlive(generation);
      }
    });

    ws.addEventListener("message", (event) => {
      if (generation !== streamGeneration) {
        return;
      }

      if (typeof event.data === "string") {
        void handleTextMessage(event.data);
        return;
      }

      streamQueue = streamQueue
        .then(() => handleBinaryMessage(event.data))
        .then(() => {
          if (decoder.hasFrames()) {
            hasVisibleFrame = true;
            reconnectAttempt = 0;
            if (firstFrameTimer) {
              window.clearTimeout(firstFrameTimer);
              firstFrameTimer = 0;
            }
            markStreamAlive(generation);
          } else {
            armFirstFrameTimer(generation);
          }
        })
        .catch((error) => {
          console.warn("Could not process display bytes.", error);
        });
    });

    ws.addEventListener("close", (event) => {
      if (generation !== streamGeneration) {
        return;
      }
      if (activeWs === ws) {
        activeWs = null;
      }
      scheduleReconnect(event);
    });

    ws.addEventListener("error", (event) => {
      if (generation !== streamGeneration) {
        return;
      }
      if (!hasVisibleFrame && !decoder.hasFrames()) {
        ui.showStatus(
          "Reconnecting...",
          "Starting live display",
          "Rebroid is opening the app screen.",
        );
      }
      console.warn("Display stream socket error.", event);
    });
  }

  return {
    connect,
    scheduleReconnect,
  };
}
