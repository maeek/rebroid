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
  const pressedKeys = new Set<string>();
  let controlWs: WebSocket | null = null;
  let reliableDataChannel: RTCDataChannel | null = null;
  let movementDataChannel: RTCDataChannel | null = null;
  let controlRequestSeq = 0;

  const pending = new Map<string, (error?: Error) => void>();
  const connectionWaitMs = 1_000;
  const responseWaitMs = 6_000;
  const maxInFlight = 32;
  let inFlight = 0;
  let pointerReleaseReserved = false;

  const readReply = (data: unknown) => {
    if (typeof data !== "string") return;
    try {
      const reply: unknown = JSON.parse(data);
      if (!isRecord(reply)) return;
      if (typeof reply.id === "string" && typeof reply.ok === "boolean") {
        pending.get(reply.id)?.(
          reply.ok && reply.executed !== false
            ? undefined
            : controlFailure(reply),
        );
      } else {
        onMessage?.(reply as JsonRecord);
      }
    } catch {
      // Ignore messages that cannot be correlated with a control.
    }
  };

  lifecycle.onClose(() => {
    for (const finish of pending.values())
      finish(new Error("The viewer closed."));
    if (
      controlWs?.readyState === WebSocket.OPEN ||
      controlWs?.readyState === WebSocket.CONNECTING
    ) {
      controlWs.close(1000, "viewer closed");
    }
  });

  async function postPublic(path: string, payload: JsonRecord): Promise<void> {
    if (!sessionId || !token)
      throw new Error("No viewer control session is available.");
    const response = await fetch(
      `/rebroid/display/public/sessions/${encodeURIComponent(sessionId)}/${path}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, token }),
        signal: AbortSignal.timeout(responseWaitMs),
      },
    );
    const result: unknown = await response.json().catch(() => null);
    if (
      !response.ok ||
      !isRecord(result) ||
      result.ok !== true ||
      result.executed === false
    ) {
      throw controlFailure(result);
    }
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
    const socket = controlWs;
    socket.onclose = () => {
      if (controlWs === socket) controlWs = null;
    };
    socket.onerror = () => undefined;
    socket.onmessage = (event) => readReply(event.data);
    return socket;
  }

  async function send(
    messagePayload: JsonRecord,
    fallbackPath: string,
    fallbackPayload?: JsonRecord,
  ): Promise<void> {
    if (lifecycle.isClosing()) throw new Error("The viewer closed.");
    const id = String(++controlRequestSeq);
    const payload = { ...messagePayload, id };
    const pointer = messagePayload.type === "touch" && messagePayload.action === "pointer";
    const movement = pointer && messagePayload.eventType === "move";
    if (movement) {
      if (!pointerReleaseReserved) return;
      if (movementDataChannel) {
        if (
          movementDataChannel.readyState === "open" &&
          movementDataChannel.bufferedAmount < 16_384
        ) {
          movementDataChannel.send(JSON.stringify(payload));
        }
      } else if (
        controlWs?.readyState === WebSocket.OPEN &&
        controlWs.bufferedAmount < 16_384
      ) {
        controlWs.send(JSON.stringify(payload));
      }
      return;
    }

    const pointerDown = pointer && messagePayload.eventType === "down";
    const pointerRelease = pointer &&
      (messagePayload.eventType === "up" || messagePayload.eventType === "cancel");
    if (pointerRelease) {
      if (!pointerReleaseReserved) return;
      pointerReleaseReserved = false;
    } else {
      const reserved = Number(pointerReleaseReserved || pointerDown);
      if ((pointerDown && pointerReleaseReserved) || inFlight + reserved >= maxInFlight) {
        throw new Error("The viewer control queue is full.");
      }
      if (pointerDown) pointerReleaseReserved = true;
    }
    inFlight += 1;
    try {
      const data = reliableDataChannel;
      if (data && (await waitForOpen(data, "open", connectionWaitMs))) {
        if (lifecycle.isClosing()) throw new Error("The viewer closed.");
        return await sendAndConfirm(id, () =>
          data.send(JSON.stringify(payload)),
        );
      }
      const ws = connectControlWs();
      if (ws && (await waitForOpen(ws, WebSocket.OPEN, connectionWaitMs))) {
        if (lifecycle.isClosing()) throw new Error("The viewer closed.");
        return await sendAndConfirm(id, () => ws.send(JSON.stringify(payload)));
      }
      if (lifecycle.isClosing()) throw new Error("The viewer closed.");
      await postPublic(fallbackPath, fallbackPayload ?? messagePayload);
    } finally {
      inFlight -= 1;
    }
  }

  function sendAndConfirm(id: string, dispatch: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const finish = (error?: Error) => {
        window.clearTimeout(timeout);
        pending.delete(id);
        if (error) reject(error);
        else resolve();
      };
      const timeout = window.setTimeout(
        () => finish(new Error("The viewer did not confirm the command.")),
        responseWaitMs,
      );
      pending.set(id, finish);
      try {
        dispatch();
      } catch {
        finish(new Error("The viewer could not send the command."));
      }
    });
  }

  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (
      event.origin !== window.location.origin ||
      event.source !== window.parent
    ) {
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
      const reply = (error?: unknown) => {
        if (typeof data.requestId !== "string") return;
        window.parent.postMessage(
          {
            type: "rebroid-viewer-control-result",
            requestId: data.requestId,
            ok: error === undefined,
            message: error instanceof Error ? error.message : undefined,
          },
          window.location.origin,
        );
      };
      void send({ type: "action", command: data.command }, "actions", {
        command: data.command,
      }).then(() => reply(), reply);
      return;
    }

    if (data.type !== keyboardEventMessageType) return;
    const key =
      typeof data.code === "string" && data.code ? data.code : data.key;
    if (typeof key !== "string" || !key) return;
    if (data.eventType === "keyup") {
      if (!pressedKeys.delete(key)) return;
    } else if (data.eventType === "keydown" && keyboardCaptureEnabled) {
      pressedKeys.add(key);
    } else {
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
      reliable.onmessage = (event) => readReply(event.data);
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

function controlFailure(reply: unknown): Error {
  if (isRecord(reply)) {
    switch (reply.code) {
      case "control_reconnecting":
        return new Error("Live controls are reconnecting. Try again in a moment.");
      case "control_not_dispatched":
        return new Error("The command was not sent to the display.");
      case "control_outcome_unknown":
        return new Error("The display may have received the command. Check before retrying.");
    }
  }
  return new Error("The display did not execute the command.");
}

function waitForOpen(
  channel: EventTarget & { readyState: string | number },
  open: string | number,
  waitMs: number,
): Promise<boolean> {
  if (channel.readyState === open) return Promise.resolve(true);
  if (
    channel.readyState !== "connecting" &&
    channel.readyState !== WebSocket.CONNECTING
  ) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timer);
      channel.removeEventListener("open", finish);
      channel.removeEventListener("close", finish);
      channel.removeEventListener("error", finish);
      resolve(channel.readyState === open);
    };
    const timer = window.setTimeout(finish, waitMs);
    channel.addEventListener("open", finish);
    channel.addEventListener("close", finish);
    channel.addEventListener("error", finish);
  });
}
