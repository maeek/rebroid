import {
  dispatchDiscreteControl,
  selectLiveControlChannel,
  type LiveControlChannel,
} from "./control-transport.js";
import {
  decodeControlReply,
  decodeParentControlMessage,
  isControlRecord,
} from "./control-messages.js";
import type { ControlChannel, JsonRecord, PageLifecycle } from "./types.js";
import type { ViewerPresentation } from "./viewer-presentation.js";

type ControlChannelOptions = {
  sessionId: string | null;
  lifecycle: PageLifecycle;
  presentation?: ViewerPresentation;
  onMessage?: (message: JsonRecord) => void;
};

export function createControlChannel({
  sessionId,
  lifecycle,
  presentation,
  onMessage,
}: ControlChannelOptions): ControlChannel {
  let keyboardCaptureEnabled = false;
  const pressedKeys = new Set<string>();
  let controlWs: WebSocket | null = null;
  let authorizedControlWs: WebSocket | null = null;
  let canControlWs = false;
  let canControlRtc = false;
  let controlWsReady: Promise<boolean> | null = null;
  let reliableDataChannel: RTCDataChannel | null = null;
  let movementDataChannel: RTCDataChannel | null = null;
  let controlRequestSeq = 0;

  const pending = new Map<string, (error?: Error) => void>();
  const connectionWaitMs = 1_000;
  const responseWaitMs = 6_000;
  const maxInFlight = 32;
  let inFlight = 0;
  let demand = new AbortController();
  let connectRequested = false;
  const activePointers = new Map<
    number,
    { payload: JsonRecord; channel: LiveControlChannel }
  >();

  const liveChannel = () =>
    selectLiveControlChannel(
      canControlRtc ? reliableDataChannel : null,
      canControlWs ? authorizedControlWs : null,
    );
  const canSendLiveInput = () => {
    if (!lifecycle.hasDemand()) return false;
    if (liveChannel()) return true;
    if (connectRequested && !authorizedControlWs) connectControlWs();
    return false;
  };

  const readReply = (
    data: unknown,
    onReady?: (canControl: boolean) => void,
    acceptStatus = true,
    onCodecChanged?: () => void,
    onVideoReset?: (remainingMs: number) => void,
  ) => {
    const reply = decodeControlReply(data);
    if (!reply) return;
    try {
      switch (reply.kind) {
        case "ready":
          onReady?.(reply.canControl);
          break;
        case "result":
          pending.get(reply.id)?.(
            reply.executed ? undefined : controlFailure(reply.payload),
          );
          break;
        case "codec-changed":
          if (acceptStatus) onCodecChanged?.();
          break;
        case "video-reset":
          if (acceptStatus) onVideoReset?.(reply.remainingMs);
          break;
        case "status":
          if (acceptStatus) onMessage?.(reply.payload);
          break;
      }
    } catch {
      // Ignore rejected control notifications.
    }
  };

  const disconnect = (reason: string) => {
    for (const { payload, channel } of activePointers.values()) {
      try {
        channel.send(
          JSON.stringify({
            ...payload,
            id: String(++controlRequestSeq),
            eventType: "cancel",
          }),
        );
      } catch {
        // The original channel may already have closed.
      }
    }
    activePointers.clear();
    pressedKeys.clear();
    demand.abort(new Error(reason));
    for (const finish of pending.values()) finish(new Error(reason));
    const socket = controlWs;
    controlWs = null;
    authorizedControlWs = null;
    controlWsReady = null;
    reliableDataChannel = null;
    movementDataChannel = null;
    if (
      socket?.readyState === WebSocket.OPEN ||
      socket?.readyState === WebSocket.CONNECTING
    ) {
      socket.close(1000, reason);
    }
  };
  lifecycle.onDemandChange((active) => {
    if (!active) {
      disconnect("Viewer suspended");
      return;
    }
    demand = new AbortController();
    if (connectRequested) connectControlWs();
  });
  lifecycle.onClose(() => disconnect("The viewer closed."));

  async function postPublic(
    path: string,
    payload: JsonRecord,
    signal: AbortSignal,
  ): Promise<void> {
    if (!sessionId) throw new Error("No viewer control session is available.");
    const response = await fetch(
      `/rebroid/display/public/sessions/${encodeURIComponent(sessionId)}/${path}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.any([signal, AbortSignal.timeout(responseWaitMs)]),
      },
    );
    const result: unknown = await response.json().catch(() => null);
    if (
      !response.ok ||
      !isControlRecord(result) ||
      result.ok !== true ||
      result.executed === false
    ) {
      throw controlFailure(result);
    }
  }

  function connectControlWs(): WebSocket | null {
    if (!sessionId || !lifecycle.hasDemand()) {
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
    const controlParams = new URLSearchParams({ sessionId });
    controlWs = new WebSocket(
      `${protocol}//${location.host}/rebroid/display/control?${controlParams.toString()}`,
    );
    const socket = controlWs;
    const signal = demand.signal;
    controlWsReady = new Promise((resolve) => {
      const abort = () => finish(false);
      const finish = (ready: boolean) => {
        window.clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        resolve(ready);
      };
      const timer = window.setTimeout(abort, connectionWaitMs);
      signal.addEventListener("abort", abort, { once: true });
      socket.onclose = () => {
        forgetClosedPointers(socket);
        if (controlWs === socket) controlWs = null;
        if (authorizedControlWs === socket) authorizedControlWs = null;
        finish(false);
      };
      socket.onerror = () => finish(false);
      const markReady = (canControl: boolean) => {
        if (controlWs !== socket) return;
        canControlWs = canControl;
        authorizedControlWs = socket;
        finish(true);
      };
      socket.onmessage = (event) =>
        readReply(event.data, markReady, controlWs === socket);
    });
    return socket;
  }

  async function send(
    messagePayload: JsonRecord,
    fallbackPath: string,
    fallbackPayload?: JsonRecord,
  ): Promise<void> {
    if (!lifecycle.hasDemand()) throw new Error("The viewer is not active.");
    const signal = demand.signal;
    const id = String(++controlRequestSeq);
    const payload = { ...messagePayload, id };
    if (
      messagePayload.type === "touch" &&
      messagePayload.action === "pointer"
    ) {
      return sendPointer(payload, id);
    }
    if (inFlight + activePointers.size >= maxInFlight)
      throw new Error("The viewer control queue is full.");
    inFlight += 1;
    try {
      await dispatchDiscreteControl(
        reliableDataChannel,
        () => {
          const socket = connectControlWs();
          return {
            socket,
            ready: socket === authorizedControlWs || controlWsReady,
          };
        },
        connectionWaitMs,
        signal,
        (channel) =>
          sendAndConfirm(id, () => channel.send(JSON.stringify(payload))),
        () =>
          postPublic(fallbackPath, fallbackPayload ?? messagePayload, signal),
      );
    } finally {
      inFlight -= 1;
    }
  }

  function forgetClosedPointers(channel: LiveControlChannel) {
    for (const [id, pointer] of activePointers) {
      if (pointer.channel === channel) activePointers.delete(id);
    }
  }

  async function sendPointer(payload: JsonRecord, requestId: string) {
    const id = typeof payload.pointerId === "number" ? payload.pointerId : -1;
    const pointer = activePointers.get(id);
    const event = payload.eventType;
    if (event === "move") {
      if (!pointer) return;
      const channel =
        pointer.channel === reliableDataChannel
          ? (movementDataChannel ?? pointer.channel)
          : pointer.channel;
      if (
        (channel.readyState === "open" ||
          channel.readyState === WebSocket.OPEN) &&
        channel.bufferedAmount < 16_384
      ) {
        pointer.payload = payload;
        channel.send(JSON.stringify(payload));
      }
      return;
    }

    const down = event === "down";
    if (!down && !pointer) return;
    const channel = pointer?.channel ?? liveChannel();
    if (!channel) throw new Error("Live pointer controls are unavailable.");
    if (down) {
      if (
        pointer ||
        activePointers.size >= 2 ||
        inFlight + activePointers.size + 1 >= maxInFlight
      ) {
        throw new Error("The viewer control queue is full.");
      }
      if (
        [...activePointers.values()].some(
          (active) => active.channel !== channel,
        )
      )
        throw new Error("Live pointer controls are reconnecting.");
    }
    inFlight += 1;
    try {
      await sendAndConfirm(requestId, () => {
        channel.send(JSON.stringify(payload));
        if (down) activePointers.set(id, { payload, channel });
        else activePointers.delete(id);
      });
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
    const message = decodeParentControlMessage(event.data);
    if (!message) return;
    if (message.kind === "keyboard-capture") {
      keyboardCaptureEnabled = message.enabled;
      return;
    }
    if (message.kind === "action") {
      const { command, requestId } = message;
      const reply = (error?: unknown) => {
        if (requestId === undefined) return;
        window.parent.postMessage(
          {
            type: "rebroid-viewer-control-result",
            requestId,
            ok: error === undefined,
            message: error instanceof Error ? error.message : undefined,
          },
          window.location.origin,
        );
      };
      if (presentation?.isCompact()) {
        reply(new Error("The mini-player is read-only while collapsed."));
        return;
      }
      void send({ type: "action", command }, "actions", { command }).then(
        () => reply(),
        reply,
      );
      return;
    }

    if (!lifecycle.hasDemand()) return;
    const { key, eventType, payload } = message;
    if (eventType === "keyup") {
      if (!pressedKeys.delete(key)) return;
    } else {
      if (!keyboardCaptureEnabled || presentation?.isCompact()) return;
      pressedKeys.add(key);
    }
    void send({ type: "keyboard", ...payload }, "keyboard", payload).catch(
      () => undefined,
    );
  });

  return {
    canSendLiveInput,
    sendScroll(payload) {
      const channel = liveChannel();
      if (
        !lifecycle.hasDemand() ||
        !channel ||
        channel.bufferedAmount >= 16_384
      )
        return;
      try {
        channel.send(JSON.stringify({ ...payload, type: "scroll" }));
      } catch {
        // Scroll deltas apply only to the live surface.
      }
    },
    connect() {
      connectRequested = true;
      return connectControlWs();
    },
    useDataChannels(
      reliable,
      movement,
      onCodecChanged,
      onVideoReset,
      canControl = true,
    ) {
      reliableDataChannel = reliable;
      canControlRtc = canControl;
      movementDataChannel = movement ?? null;
      reliable.onmessage = (event) =>
        readReply(
          event.data,
          undefined,
          reliableDataChannel === reliable,
          onCodecChanged,
          onVideoReset,
        );
      reliable.onclose = () => {
        forgetClosedPointers(reliable);
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
  if (isControlRecord(reply)) {
    switch (reply.code) {
      case "control_reconnecting":
        return new Error(
          "Live controls are reconnecting. Try again in a moment.",
        );
      case "control_not_dispatched":
        return new Error("The command was not sent to the display.");
      case "control_outcome_unknown":
        return new Error(
          "The display may have received the command. Check before retrying.",
        );
    }
  }
  return new Error("The display did not execute the command.");
}
