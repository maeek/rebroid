import assert from "node:assert/strict";
import test from "node:test";

class FakeWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static instances = [];
  readyState = FakeWebSocket.CONNECTING;
  messages = [];

  constructor() {
    super();
    FakeWebSocket.instances.push(this);
  }

  send(message) {
    this.messages.push(JSON.parse(message));
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
    this.dispatchEvent(new Event("close"));
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  reply(payload) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

test("only the parent can change presentation and compact mode releases an active touch", async (t) => {
  const { createViewerPresentation } =
    await import("../dist/modules/display/viewer/assets/viewer-presentation.js");
  const { setupTouchInput } =
    await import("../dist/modules/display/viewer/assets/touch-input.js");
  const origin = "https://rebroid.test";
  const replies = [];
  const parent = { postMessage: (message) => replies.push(message) };
  const window = Object.assign(new EventTarget(), {
    parent,
    location: { origin },
    frameElement: { hasAttribute: () => false },
  });
  const originalWindow = globalThis.window;
  const originalHTMLElement = globalThis.HTMLElement;
  const closeCallbacks = new Set();
  const lifecycle = {
    hasDemand: () => true,
    onDemandChange: () => () => false,
    onClose: (listener) => closeCallbacks.add(listener),
  };
  Object.assign(globalThis, { window, HTMLElement: EventTarget });
  t.after(() => {
    for (const close of closeCallbacks) close();
    Object.assign(globalThis, {
      window: originalWindow,
      HTMLElement: originalHTMLElement,
    });
  });
  const presentation = createViewerPresentation(lifecycle);
  const sent = [];
  let captured = false;
  const target = Object.assign(new EventTarget(), {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 200 }),
    classList: { contains: () => false },
    setPointerCapture: () => {
      captured = true;
    },
    hasPointerCapture: () => captured,
    releasePointerCapture: () => {
      captured = false;
    },
  });
  setupTouchInput({
    target,
    getVideoSize: () => ({ width: 100, height: 200 }),
    controlChannel: {
      send: async (message) => {
        sent.push(message);
      },
    },
    lifecycle,
    presentation,
  });

  const receive = (compact, source = parent, messageOrigin = origin) =>
    window.dispatchEvent(
      Object.assign(new Event("message"), {
        source,
        origin: messageOrigin,
        data: {
          type: "rebroid-viewer-presentation",
          compact,
          minimizeShortcutEnabled: !compact,
        },
      }),
    );
  const touchDown = () =>
    target.dispatchEvent(
      Object.assign(new Event("pointerdown", { cancelable: true }), {
        pointerType: "mouse",
        button: 0,
        pointerId: 1,
        clientX: 4,
        clientY: 8,
      }),
    );
  const pressShortcut = () =>
    window.dispatchEvent(
      Object.assign(new Event("keydown", { cancelable: true }), { key: "i" }),
    );
  window.closest = () => null;

  receive(true, {});
  receive(true, parent, "https://foreign.test");
  assert.equal(presentation.isCompact(), false);
  assert.equal(pressShortcut(), true);
  touchDown();
  assert.equal(captured, true);
  receive(true);
  assert.equal(captured, false);
  touchDown();
  assert.deepEqual(
    sent.map(({ eventType }) => eventType),
    ["down", "cancel"],
  );
  assert.equal(pressShortcut(), true);
  assert.deepEqual(replies, []);

  receive(false);
  touchDown();
  assert.deepEqual(
    sent.map(({ eventType }) => eventType),
    ["down", "cancel", "down"],
  );
  assert.equal(pressShortcut(), false);
  assert.deepEqual(replies, [{ type: "rebroid-viewer-minimize-shortcut" }]);
});

test("a hidden viewer closes controls and opens them once on return", async (t) => {
  const original = {
    window: globalThis.window,
    document: globalThis.document,
    location: globalThis.location,
    WebSocket: globalThis.WebSocket,
  };
  const window = Object.assign(new EventTarget(), { setTimeout, clearTimeout });
  const document = Object.assign(new EventTarget(), {
    visibilityState: "hidden",
  });
  Object.assign(globalThis, {
    window,
    document,
    WebSocket: FakeWebSocket,
    location: { protocol: "https:", host: "rebroid.test" },
  });
  const { createControlChannel } =
    await import("../dist/modules/display/viewer/assets/control-channel.js");
  const { createPageLifecycle } =
    await import("../dist/modules/display/viewer/assets/page-lifecycle.js");
  const lifecycle = createPageLifecycle(true);
  const channel = createControlChannel({ sessionId: "session", lifecycle });
  const initialSocketCount = FakeWebSocket.instances.length;
  t.after(() => {
    window.dispatchEvent(new Event("pagehide"));
    Object.assign(globalThis, original);
  });

  assert.equal(channel.connect(), null);
  await assert.rejects(
    channel.send({ type: "action", command: "home" }, "actions"),
    /not active/,
  );
  const setVisibility = (state) => {
    document.visibilityState = state;
    document.dispatchEvent(new Event("visibilitychange"));
  };
  setVisibility("visible");
  setVisibility("visible");
  assert.equal(FakeWebSocket.instances.length, initialSocketCount + 1);
  const socket = FakeWebSocket.instances.at(-1);
  socket.open();
  socket.reply({ type: "control-ready" });
  const down = channel.send(
    { type: "touch", action: "pointer", eventType: "down", x: 1, y: 2 },
    "touch",
  );
  const failed = assert.rejects(down, /suspended/i);
  assert.equal(socket.messages[0].eventType, "down");
  setVisibility("hidden");
  await failed;
  assert.equal(socket.messages[1].eventType, "cancel");
  assert.equal(socket.readyState, 3);
  assert.equal(FakeWebSocket.instances.length, initialSocketCount + 1);
  setVisibility("visible");
  const persisted = Object.assign(new Event("pagehide"), { persisted: true });
  window.dispatchEvent(persisted);
  assert.equal(lifecycle.isClosing(), false);
  assert.equal(lifecycle.hasDemand(), false);
  window.dispatchEvent(new Event("pageshow"));
  window.dispatchEvent(new Event("pageshow"));
  assert.equal(FakeWebSocket.instances.length, initialSocketCount + 3);
});

test("a discrete command waits for its own reply and never retries a sent command", async (t) => {
  const original = {
    window: globalThis.window,
    location: globalThis.location,
    WebSocket: globalThis.WebSocket,
    fetch: globalThis.fetch,
  };
  const parent = new EventTarget();
  Object.assign(parent, { setTimeout, clearTimeout });
  const fetchCalls = [];
  Object.assign(globalThis, {
    window: parent,
    location: { protocol: "https:", host: "rebroid.test" },
    WebSocket: FakeWebSocket,
    fetch: async (...args) => {
      fetchCalls.push(args);
      return new Response(JSON.stringify({ code: "control_reconnecting" }), {
        status: 409,
      });
    },
  });
  const closeListeners = [];
  t.after(() => {
    try {
      closeListeners.forEach((listener) => listener());
    } finally {
      Object.assign(globalThis, original);
    }
  });
  const { createControlChannel } = await import(
    new URL(
      "../dist/modules/display/viewer/assets/control-channel.js",
      import.meta.url,
    )
  );
  const channel = createControlChannel({
    sessionId: "session",
    lifecycle: {
      isClosing: () => false,
      hasDemand: () => true,
      onDemandChange: () => () => undefined,
      onClose: (listener) => closeListeners.push(listener),
    },
  });
  const socket = channel.connect();
  let finished = false;
  const sent = channel
    .send({ type: "action", command: "home" }, "actions")
    .then(() => {
      finished = true;
    });
  assert.equal(socket.messages.length, 0);
  socket.open();
  await Promise.resolve();
  assert.equal(socket.messages.length, 0);
  socket.reply({ type: "control-ready" });
  await Promise.resolve();
  assert.equal(socket.messages.length, 1);
  socket.reply({ id: "unrelated", ok: true, executed: true });
  await Promise.resolve();
  assert.equal(finished, false);
  socket.reply({ id: socket.messages[0].id, ok: true, executed: true });
  await sent;

  const rejected = assert.rejects(
    channel.send({ type: "action", command: "home" }, "actions"),
    /reconnecting/,
  );
  await Promise.resolve();
  socket.reply({
    id: socket.messages[1].id,
    ok: false,
    code: "control_reconnecting",
  });
  await rejected;
  assert.equal(socket.messages.length, 2);
  assert.equal(fetchCalls.length, 0);

  const uncertain = assert.rejects(
    channel.send({ type: "action", command: "home" }, "actions"),
    /may have received the command/,
  );
  await Promise.resolve();
  socket.reply({
    id: socket.messages[2].id,
    ok: false,
    code: "control_outcome_unknown",
  });
  await uncertain;
  assert.equal(fetchCalls.length, 0);

  socket.close();
  const unavailable = assert.rejects(
    channel.send({ type: "action", command: "home" }, "actions"),
    /reconnecting/,
  );
  FakeWebSocket.instances.at(-1).close();
  await unavailable;
  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0][0], /public\/sessions\/session\/actions$/);

  const activeSocket = channel.connect();
  activeSocket.open();
  activeSocket.reply({ type: "control-ready" });
  const pointer = (eventType) =>
    channel.send({ type: "touch", action: "pointer", eventType }, "touch");
  const pending = [pointer("down")];
  for (let index = 0; index < 30; index++) {
    pending.push(channel.send({ type: "action", command: "home" }, "actions"));
  }
  await assert.rejects(
    channel.send({ type: "action", command: "home" }, "actions"),
    /queue is full/,
  );
  pending.push(pointer("cancel"));
  await Promise.resolve();
  assert.equal(activeSocket.messages.length, 32);
  assert.deepEqual(
    activeSocket.messages
      .filter((message) => message.type === "touch")
      .map((message) => message.eventType),
    ["down", "cancel"],
  );
  for (const { id } of activeSocket.messages)
    activeSocket.reply({ id, ok: true });
  await Promise.all(pending);
});

test("retired transports cannot publish diagnostics but can acknowledge dispatched controls", async (t) => {
  const original = {
    window: globalThis.window,
    location: globalThis.location,
    WebSocket: globalThis.WebSocket,
  };
  const parent = new EventTarget();
  Object.assign(parent, { setTimeout, clearTimeout });
  Object.assign(globalThis, {
    window: parent,
    location: { protocol: "https:", host: "rebroid.test" },
    WebSocket: FakeWebSocket,
  });
  const closeListeners = [];
  t.after(() => {
    closeListeners.forEach((listener) => listener());
    Object.assign(globalThis, original);
  });
  const { createControlChannel } =
    await import("../dist/modules/display/viewer/assets/control-channel.js");
  const statuses = [];
  const channel = createControlChannel({
    sessionId: "session",
    lifecycle: {
      isClosing: () => false,
      hasDemand: () => true,
      onDemandChange: () => () => undefined,
      onClose: (listener) => closeListeners.push(listener),
    },
    onMessage: (message) => statuses.push(message),
  });
  const oldSocket = channel.connect();
  oldSocket.open();
  oldSocket.reply({ type: "control-ready" });
  oldSocket.close();
  const socket = channel.connect();
  socket.open();
  socket.reply({ type: "control-ready" });
  oldSocket.reply({ type: "ready", sourceAttemptId: "retired-socket" });
  socket.reply({ type: "ready", sourceAttemptId: "current-socket" });

  const oldData = new FakeWebSocket();
  oldData.readyState = "open";
  channel.useDataChannels(oldData);
  const pending = channel.send({ type: "action", command: "home" }, "actions");
  await Promise.resolve();
  assert.equal(oldData.messages.length, 1);
  const data = new FakeWebSocket();
  data.readyState = "open";
  channel.useDataChannels(data);
  oldData.reply({ type: "ready", sourceAttemptId: "retired-data" });
  data.reply({ type: "ready", sourceAttemptId: "current-data" });
  oldData.reply({ id: oldData.messages[0].id, ok: true });
  await pending;
  assert.deepEqual(
    statuses.map((message) => message.sourceAttemptId),
    ["current-socket", "current-data"],
  );
});

test("rotation notices and reliable close recover only the active WebRTC peer", async (t) => {
  const callbacks = [];
  const retries = new Map();
  const status = [];
  const peers = [];
  const window = Object.assign(new EventTarget(), {
    location: { origin: "https://rebroid.test" },
    parent: { postMessage: (message) => status.push(message) },
    setTimeout(callback, ms) {
      if (ms !== 300) return setTimeout(callback, ms);
      const timer = Symbol("first retry");
      retries.set(timer, callback);
      return timer;
    },
    clearTimeout(timer) {
      if (!retries.delete(timer)) clearTimeout(timer);
    },
    setInterval,
    clearInterval,
  });
  const track = Object.assign(new EventTarget(), { kind: "video", stop() {} });
  class Stream {
    getVideoTracks() {
      return [track];
    }
    getTracks() {
      return [track];
    }
  }
  class Peer extends EventTarget {
    connectionState = "new";
    iceConnectionState = "new";
    iceGatheringState = "complete";
    channels = [];

    constructor() {
      super();
      peers.push(this);
    }

    createDataChannel() {
      const channel = new FakeWebSocket();
      channel.readyState = "connecting";
      this.channels.push(channel);
      return channel;
    }

    addTransceiver() {
      return {};
    }
    async createOffer() {
      return { sdp: "offer" };
    }
    async setLocalDescription(offer) {
      this.localDescription = offer;
    }
    async setRemoteDescription() {
      this.connectionState = "connected";
      const [reliable] = this.channels;
      reliable.readyState = "open";
      reliable.dispatchEvent(new Event("open"));
      this.dispatchEvent(
        Object.assign(new Event("track"), {
          receiver: {},
          track,
          streams: [new Stream()],
        }),
      );
    }

    close() {
      this.connectionState = "closed";
      for (const channel of this.channels) channel.close();
      this.dispatchEvent(new Event("connectionstatechange"));
    }
  }
  window.RTCPeerConnection = Peer;
  const video = Object.assign(new EventTarget(), {
    readyState: 0,
    videoWidth: 0,
    videoHeight: 0,
    play: async () => undefined,
    pause: () => undefined,
    removeAttribute: () => undefined,
  });
  let media;
  Object.defineProperty(video, "srcObject", {
    get: () => media,
    set: (value) => {
      media = value;
      video.readyState = 0;
    },
  });
  const globals = {
    window,
    RTCPeerConnection: Peer,
    RTCRtpReceiver: { getCapabilities: () => null },
    MediaStream: Stream,
    HTMLMediaElement: { HAVE_CURRENT_DATA: 2 },
    fetch: async () => Response.json({ sdp: "answer" }),
  };
  const original = Object.fromEntries(
    Object.keys(globals).map((key) => [key, globalThis[key]]),
  );
  Object.assign(globalThis, globals);
  let closing = false;
  t.after(() => {
    closing = true;
    callbacks.forEach((callback) => callback());
    Object.assign(globalThis, original);
  });
  const { createControlChannel } =
    await import("../dist/modules/display/viewer/assets/control-channel.js");
  const { createWebrtcStream } =
    await import("../dist/modules/display/viewer/assets/webrtc-stream.js");
  const lifecycle = {
    onClose: (callback) => callbacks.push(callback),
    isClosing: () => closing,
    hasDemand: () => !closing,
    onDemandChange: () => () => undefined,
  };
  const config = {
    sessionId: "session",
    params: new URLSearchParams(),
    streamDefaults: {},
    audio: false,
  };
  const controlChannel = createControlChannel({
    sessionId: config.sessionId,
    lifecycle,
  });
  const surfaces = [];
  const stream = createWebrtcStream({
    config,
    video,
    lifecycle,
    controlChannel,
    getRelayMetrics: () => null,
    ui: {
      showStatus: () => surfaces.push("starting"),
      showVideo: () => surfaces.push("video"),
      showFailure: () => surfaces.push("failure"),
      preserveVideoFrame: () => {
        surfaces.push("held");
        return true;
      },
    },
  });
  const turn = () => new Promise((resolve) => setImmediate(resolve));
  const present = (width, height) => {
    Object.assign(video, {
      readyState: 2,
      videoWidth: width,
      videoHeight: height,
    });
    video.dispatchEvent(new Event("loadeddata"));
  };
  const initial = stream.connect();
  await turn();
  present(1080, 2340);
  await initial;
  assert.deepEqual(surfaces, ["starting", "video"]);

  const [old] = peers[0].channels;
  const change = {
    type: "webrtc-codec-changed",
    consumerAttemptId: "portrait",
  };
  old.reply({ ...change, consumerAttemptId: "" });
  old.reply({ ...change, filler: " ".repeat(256) });
  assert.equal(retries.size, 0);
  old.reply(change);
  old.reply(change);
  assert.deepEqual(surfaces, ["starting", "video", "held"]);
  assert.equal(retries.size, 1);
  assert.equal(
    status.filter((event) => event.code === "reconnecting").length,
    1,
  );
  const [[timer, reconnect]] = retries;
  retries.delete(timer);
  reconnect();
  await turn();
  assert.equal(peers.length, 2);
  old.reply(change);
  assert.equal(retries.size, 0);
  assert.equal(surfaces.at(-1), "held");

  present(2340, 1080);
  await turn();
  assert.equal(surfaces.at(-1), "video");
  const [current] = peers[1].channels;
  current.close();
  assert.equal(
    retries.size,
    1,
    "closed ordered channel should recover without ICE timeout",
  );
  assert.equal(surfaces.at(-1), "held");
});
