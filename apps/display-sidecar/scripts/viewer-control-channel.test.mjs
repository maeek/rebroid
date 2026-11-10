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
  t.after(() => Object.assign(globalThis, original));
  const { createControlChannel } = await import(
    new URL(
      "../dist/modules/display/viewer/assets/control-channel.js",
      import.meta.url,
    )
  );
  const closeListeners = [];
  const channel = createControlChannel({
    sessionId: "session",
    token: "token",
    lifecycle: {
      isClosing: () => false,
      onClose: (listener) => closeListeners.push(listener),
    },
  });
  t.after(() => closeListeners.forEach((listener) => listener()));
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
