import {
  keyboardCaptureMessageType,
  keyboardEventMessageType,
  viewerControlMessageType,
} from "./config.js";
import type { ControlChannel, JsonRecord, PageLifecycle } from "./types.js";

type ControlChannelOptions = {
  sessionId: string | null;
  token: string | null;
  lifecycle: PageLifecycle;
  onMessage?: (message: JsonRecord) => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

export function createControlChannel({
  sessionId,
  token,
  lifecycle,
  onMessage,
}: ControlChannelOptions): ControlChannel {
  let keyboardCaptureEnabled = false;
  let controlWs: WebSocket | null = null;
  let reliableDataChannel: RTCDataChannel | null = null;
  let movementDataChannel: RTCDataChannel | null = null;
  let controlRequestSeq = 0;

  lifecycle.onClose(() => {
    if (controlWs?.readyState === WebSocket.OPEN) {
      controlWs.close(1000, "viewer closed");
    }
  });

  async function postPublic(path: string, payload: JsonRecord): Promise<void> {
    if (!sessionId || !token) {
      return;
    }

    await fetch(
      `/rebroid/display/public/sessions/${encodeURIComponent(sessionId)}/${path}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, ...payload }),
      },
    );
  }

  function connectControlWs(): WebSocket | null {
    if (!sessionId || !token) {
      return null;
    }

    if (
      controlWs &&
      (controlWs.readyState === WebSocket.OPEN ||
        controlWs.readyState === WebSocket.CONNECTING)
    ) {
      return controlWs;
    }

    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const controlParams = new URLSearchParams({ sessionId, token });
    controlWs = new WebSocket(
      `${protocol}//${location.host}/rebroid/display/control?${controlParams.toString()}`,
    );
    controlWs.onclose = () => {
      controlWs = null;
    };
    controlWs.onerror = () => undefined;
    return controlWs;
  }

  function send(
    messagePayload: JsonRecord,
    fallbackPath: string,
    fallbackPayload?: JsonRecord,
  ): Promise<void> {
    const payload = {
      id: String(++controlRequestSeq),
      ...messagePayload,
    };

    const movement =
      messagePayload.type === "touch" &&
      messagePayload.action === "pointer" &&
      messagePayload.eventType === "move";
    const dataChannel = movement ? movementDataChannel : reliableDataChannel;
    if (dataChannel?.readyState === "open") {
      dataChannel.send(JSON.stringify(payload));
      return Promise.resolve();
    }

    if (movement && movementDataChannel) {
      return Promise.resolve();
    }

    if (dataChannel?.readyState === "connecting") {
      dataChannel.addEventListener(
        "open",
        () => {
          if (dataChannel?.readyState === "open") {
            dataChannel.send(JSON.stringify(payload));
          }
        },
        { once: true },
      );
      return Promise.resolve();
    }

    const ws = connectControlWs();
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return Promise.resolve();
    }

    if (ws?.readyState === WebSocket.CONNECTING) {
      ws.addEventListener(
        "open",
        () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(payload));
          }
        },
        { once: true },
      );
      return Promise.resolve();
    }

    return postPublic(fallbackPath, fallbackPayload ?? messagePayload);
  }

  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.origin !== window.location.origin || event.source !== window.parent) {
      return;
    }
    const data = isRecord(event.data) ? event.data : {};
    if (
      data.type === keyboardCaptureMessageType &&
      typeof data.enabled === "boolean"
    ) {
      keyboardCaptureEnabled = data.enabled;
      return;
    }

    if (
      data.type === viewerControlMessageType &&
      typeof data.command === "string"
    ) {
      send({ type: "action", command: data.command }, "actions", {
        command: data.command,
      }).catch(() => undefined);
      return;
    }

    if (data.type !== keyboardEventMessageType || !keyboardCaptureEnabled) {
      return;
    }

    const keyboardPayload: JsonRecord = {
      eventType: typeof data.eventType === "string" ? data.eventType : "",
      key: typeof data.key === "string" ? data.key : "",
      code: typeof data.code === "string" ? data.code : "",
      repeat: data.repeat === true,
      altKey: data.altKey === true,
      ctrlKey: data.ctrlKey === true,
      metaKey: data.metaKey === true,
      shiftKey: data.shiftKey === true,
    };
    send(
      { type: "keyboard", ...keyboardPayload },
      "keyboard",
      keyboardPayload,
    ).catch(() => undefined);
  });

  return {
    connect: connectControlWs,
    useDataChannels(reliable: RTCDataChannel, movement?: RTCDataChannel) {
      reliableDataChannel = reliable;
      movementDataChannel = movement ?? null;
      reliable.onmessage = (event) => {
        if (typeof event.data !== "string") {
          return;
        }
        try {
          const parsed: unknown = JSON.parse(event.data);
          if (isRecord(parsed)) {
            onMessage?.(parsed as JsonRecord);
          }
        } catch {
          return;
        }
      };
      reliable.onclose = () => {
        if (reliableDataChannel === reliable) {
          reliableDataChannel = null;
        }
      };
      if (movement) {
        movement.onclose = () => {
          if (movementDataChannel === movement) {
            movementDataChannel = null;
          }
        };
      }
    },
    send,
  };
}
