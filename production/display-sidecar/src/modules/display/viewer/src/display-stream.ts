import type { DisplayDecoder, ViewerConfig, ViewerUi, PageLifecycle } from "./types";

type DisplayStreamOptions = {
  config: ViewerConfig;
  decoder: DisplayDecoder;
  ui: ViewerUi;
  lifecycle: PageLifecycle;
};

type StreamTextMessage = {
  type?: unknown;
  message?: unknown;
  text?: unknown;
};

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
}: DisplayStreamOptions) {
  let activeWs: WebSocket | null = null;
  let reconnectTimer = 0;
  let reconnectAttempt = 0;
  let streamGeneration = 0;
  let streamQueue: Promise<void> = Promise.resolve();

  lifecycle.onClose(() => {
    if (activeWs?.readyState === WebSocket.OPEN) {
      activeWs.close(1000, "viewer closed");
    }
  });

  function resetForReconnect() {
    streamQueue = Promise.resolve();
    decoder.reset();
  }

  function scheduleReconnect(event?: CloseEvent): void {
    if (lifecycle.isClosing() || reconnectTimer) {
      return;
    }

    streamGeneration += 1;
    resetForReconnect();
    const hadFrames = decoder.hasFrames();
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

    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = 0;
      connect().catch(error => {
        console.warn("Could not reconnect display stream.", error);
        scheduleReconnect();
      });
    }, delay);
  }

  async function handleTextMessage(text: string): Promise<void> {
    const payload = parseTextMessage(text);
    if (!payload) {
      if (!decoder.hasFrames()) {
        ui.showStatus("Preparing live display...");
      }
      return;
    }

    if (payload.type === "reconnecting") {
      resetForReconnect();
      if (!decoder.hasFrames()) {
        ui.showStatus(
          typeof payload.message === "string"
            ? payload.message
            : "Reconnecting live display...",
        );
      }
      return;
    }

    if (payload.type === "clipboard" && typeof payload.text === "string") {
      window.parent.postMessage(
        { type: "rebroid-viewer-clipboard", text: payload.text },
        "*",
      );
      if (navigator.clipboard && document.visibilityState === "visible") {
        await navigator.clipboard.writeText(payload.text).catch(() => undefined);
      }
      return;
    }

    if (!decoder.hasFrames()) {
      ui.showStatus(
        typeof payload.message === "string"
          ? payload.message
          : "Preparing live display...",
      );
    }
  }

  async function handleBinaryMessage(data: unknown): Promise<void> {
    if (data instanceof ArrayBuffer) {
      await decoder.appendStreamBytes(new Uint8Array(data));
      return;
    }

    if (data instanceof Blob) {
      await decoder.appendStreamBytes(new Uint8Array(await data.arrayBuffer()));
    }
  }

  async function connect(): Promise<void> {
    if (!config.sessionId || !config.token) {
      ui.showFailure("Open the viewer again from the app page.");
      return;
    }

    if (!("VideoDecoder" in window) || !("EncodedVideoChunk" in window)) {
      ui.showFailure("Open Rebroid over HTTPS in a compatible browser and try again.");
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
      if (!decoder.hasFrames()) {
        ui.showStatus(
          "Waiting for the first frame...",
          "Starting live display",
          "Rebroid is opening the app screen.",
        );
      }
    });

    ws.addEventListener("message", event => {
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
            reconnectAttempt = 0;
          }
        })
        .catch(error => {
          console.warn("Could not process display bytes.", error);
        });
    });

    ws.addEventListener("close", event => {
      if (generation !== streamGeneration) {
        return;
      }
      if (activeWs === ws) {
        activeWs = null;
      }
      scheduleReconnect(event);
    });

    ws.addEventListener("error", event => {
      if (generation !== streamGeneration) {
        return;
      }
      if (!decoder.hasFrames()) {
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
