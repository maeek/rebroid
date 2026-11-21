import assert from "node:assert/strict";
import test from "node:test";

class FakeWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static instances = [];
  readyState = FakeWebSocket.CONNECTING;
  bufferedAmount = 0;
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
      canSendLiveInput: () => true,
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
  const activateDisplay = () => window.dispatchEvent(new Event("pointerdown"));

  receive(true, {});
  receive(true, parent, "https://foreign.test");
  assert.equal(presentation.isCompact(), false);
  assert.equal(pressShortcut(), true);
  activateDisplay();
  assert.deepEqual(replies.splice(0), [
    { type: "rebroid-viewer-activate-display" },
  ]);
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
  activateDisplay();
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

test("wheel deltas coalesce over Android content and Ctrl-wheel stays with the browser", async (t) => {
  const { target, flushFrame, sent, dispatch } = await inputFixture(t);
  const wheel = (properties) =>
    dispatch("wheel", {
      clientX: 100,
      clientY: 100,
      deltaMode: 0,
      deltaX: 0,
      deltaY: 0,
      ...properties,
    });
  assert.equal(wheel({ clientX: 20, deltaY: 48 }), true, "letterbox");
  assert.equal(wheel({ ctrlKey: true, deltaY: 48 }), true, "browser zoom");
  assert.equal(wheel({ deltaX: 12, deltaY: 24 }), false);
  assert.equal(wheel({ deltaX: 12, deltaY: 3, deltaMode: 1 }), false);
  flushFrame();
  assert.deepEqual(sent.splice(0), [
    {
      type: "scroll",
      x: 50,
      y: 100,
      videoWidth: 100,
      videoHeight: 200,
      horizontal: -4.25,
      vertical: -1.5,
    },
  ]);
  wheel({ deltaY: 48 });
  target.classList.contains = () => true;
  flushFrame();
  assert.deepEqual(sent, []);
});

test("touch and mouse gestures send distinct contacts and release them on cancellation", async (t) => {
  const { flushFrame, sent, dispatch } = await inputFixture(t);
  const pointer = (phase, id, clientX, properties) =>
    dispatch(`pointer${phase}`, {
      clientX,
      clientY: 40,
      pointerType: "touch",
      pointerId: id,
      button: 0,
      ...properties,
    });
  pointer("down", 10, 75);
  pointer("down", 11, 125);
  pointer("down", 12, 95);
  pointer("move", 10, 65);
  pointer("move", 11, 135);
  flushFrame();
  pointer("up", 10, 65);
  pointer("cancel", 11, 135);
  const [firstId, secondId] = sent.map(({ pointerId }) => pointerId);
  assert.notEqual(firstId, secondId);
  assert.deepEqual(
    sent
      .splice(0)
      .map(({ eventType, pointerId, x }) => [eventType, pointerId, x]),
    [
      ["down", firstId, 25],
      ["down", secondId, 75],
      ["move", firstId, 15],
      ["move", secondId, 85],
      ["up", firstId, 15],
      ["cancel", secondId, 85],
    ],
  );
  pointer("down", 13, 65, { pointerType: "mouse", ctrlKey: true });
  pointer("move", 13, 75, { pointerType: "mouse", ctrlKey: false });
  flushFrame();
  pointer("up", 13, 75);
  assert.deepEqual(
    sent.map(({ eventType, x, y }) => [eventType, x, y]),
    [
      ["down", 15, 40],
      ["down", 84, 159],
      ["move", 25, 40],
      ["move", 74, 159],
      ["up", 25, 40],
      ["up", 74, 159],
    ],
  );
});

async function inputFixture(t) {
  const { setupTouchInput } =
    await import("../dist/modules/display/viewer/assets/touch-input.js");
  const previousWindow = globalThis.window;
  const frames = new Map();
  let nextFrame = 0;
  globalThis.window = Object.assign(new EventTarget(), {
    requestAnimationFrame(callback) {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
  });
  t.after(() => {
    globalThis.window = previousWindow;
  });
  const captures = new Set();
  const sent = [];
  const target = Object.assign(new EventTarget(), {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }),
    classList: { contains: () => false },
    setPointerCapture: (id) => captures.add(id),
    hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
  });
  setupTouchInput({
    target,
    getVideoSize: () => ({ width: 100, height: 200 }),
    controlChannel: {
      canSendLiveInput: () => true,
      sendScroll: (payload) => sent.push({ type: "scroll", ...payload }),
      send: async (message) => sent.push(message),
    },
    lifecycle: {
      hasDemand: () => true,
      onDemandChange() {},
      onClose() {},
    },
  });
  return {
    target,
    sent,
    dispatch: (type, properties) =>
      target.dispatchEvent(
        Object.assign(new Event(type, { cancelable: true }), properties),
      ),
    flushFrame() {
      for (const [id, callback] of frames) {
        frames.delete(id);
        callback();
      }
    },
  };
}

test("both transports carry scroll and two contacts stay on their original live channel", async (t) => {
  const globals = {
    window: Object.assign(new EventTarget(), { setTimeout, clearTimeout }),
    location: { protocol: "https:", host: "rebroid.test" },
    WebSocket: FakeWebSocket,
  };
  const original = Object.fromEntries(
    Object.keys(globals).map((key) => [key, globalThis[key]]),
  );
  Object.assign(globalThis, globals);
  t.after(() => Object.assign(globalThis, original));

  const { createControlChannel } =
    await import("../dist/modules/display/viewer/assets/control-channel.js");
  const channel = createControlChannel({
    sessionId: "session",
    lifecycle: {
      hasDemand: () => true,
      onDemandChange() {},
      onClose() {},
    },
  });
  const socket = channel.connect();
  socket.open();
  socket.reply({ type: "control-ready", canControl: false });
  assert.equal(channel.canSendLiveInput(), false);
  socket.reply({ type: "control-ready", canControl: true });
  channel.sendScroll({ horizontal: -1, vertical: 2 });
  assert.equal(socket.messages.at(-1).type, "scroll");

  const rtc = new FakeWebSocket();
  const movement = new FakeWebSocket();
  rtc.readyState = movement.readyState = "open";
  channel.useDataChannels(rtc, movement, undefined, undefined, true);
  channel.sendScroll({ horizontal: 1, vertical: -2 });
  assert.equal(rtc.messages.at(-1).type, "scroll");

  const pointer = (eventType, pointerId) =>
    channel.send(
      { type: "touch", action: "pointer", eventType, pointerId },
      "touch",
    );
  const down = [pointer("down", 2), pointer("down", 5)];
  for (const message of rtc.messages.slice(-2))
    rtc.reply({ id: message.id, ok: true });
  await Promise.all(down);
  await pointer("move", 2);
  await pointer("move", 5);
  assert.deepEqual(
    movement.messages.map(({ pointerId }) => pointerId),
    [2, 5],
  );

  rtc.close();
  await pointer("up", 2);
  await pointer("move", 5);
  await pointer("cancel", 5);
  assert.equal(socket.messages.length, 1);
  assert.equal(movement.messages.length, 2);

  socket.close();
  assert.equal(channel.canSendLiveInput(), false);
  const replacement = FakeWebSocket.instances.at(-1);
  assert.notEqual(replacement, socket);
  replacement.open();
  replacement.reply({ type: "control-ready", canControl: true });
  assert.equal(channel.canSendLiveInput(), true);
  assert.deepEqual(replacement.messages, []);
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
  const pointer = (eventType, pointerId) =>
    channel.send(
      { type: "touch", action: "pointer", eventType, pointerId },
      "touch",
    );
  const pending = [pointer("down", 2), pointer("down", 5)];
  for (let index = 0; index < 28; index++) {
    pending.push(channel.send({ type: "action", command: "home" }, "actions"));
  }
  await assert.rejects(
    channel.send({ type: "action", command: "home" }, "actions"),
    /queue is full/,
  );
  pending.push(pointer("cancel", 2), pointer("up", 5));
  await Promise.resolve();
  assert.equal(activeSocket.messages.length, 32);
  assert.deepEqual(
    activeSocket.messages
      .filter((message) => message.type === "touch")
      .map((message) => message.eventType),
    ["down", "down", "cancel", "up"],
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
  const resetWindows = [];
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
  channel.useDataChannels(oldData, undefined, undefined, (ms) =>
    resetWindows.push(ms),
  );
  const pending = channel.send({ type: "action", command: "home" }, "actions");
  await Promise.resolve();
  assert.equal(oldData.messages.length, 1);
  const data = new FakeWebSocket();
  data.readyState = "open";
  channel.useDataChannels(data, undefined, undefined, (ms) =>
    resetWindows.push(ms),
  );
  oldData.reply({ type: "ready", sourceAttemptId: "retired-data" });
  data.reply({ type: "ready", sourceAttemptId: "current-data" });
  oldData.reply({ type: "webrtc-video-reset", remainingMs: 3_000 });
  data.reply({ type: "webrtc-video-reset", remainingMs: "3000" });
  data.reply({ type: "webrtc-video-reset", remainingMs: 2_850 });
  oldData.reply({ id: oldData.messages[0].id, ok: true });
  await pending;
  assert.deepEqual(
    statuses.map((message) => message.sourceAttemptId),
    ["current-socket", "current-data"],
  );
  assert.deepEqual(resetWindows, [2_850]);
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
      showStatus: (_text, title) => surfaces.push(title),
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
  assert.deepEqual(surfaces, [
    "Connecting to live display",
    "Waiting for the first frame",
    "video",
  ]);

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
  assert.deepEqual(surfaces, [
    "Connecting to live display",
    "Waiting for the first frame",
    "video",
    "held",
  ]);
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
