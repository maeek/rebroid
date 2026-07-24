import assert from "node:assert/strict";
import test from "node:test";

const annexB = (...nals) =>
  Uint8Array.from(nals.flatMap((nal) => [0, 0, 0, 1, ...nal]));
const configuration = annexB(
  [
    0x67, 0x42, 0xc0, 0x33, 0xd9, 0x00, 0x44, 0x01, 0x27, 0xe5, 0x9f, 0x01,
    0x10, 0x00, 0x00, 0x03, 0x00, 0x10, 0x00, 0x00, 0x07, 0x80, 0xf1, 0x83,
    0x24, 0x80,
  ],
  [0x68, 0xcb, 0x83, 0xcb, 0x20],
);
const keyFrame = annexB([0x65, 0x88, 0x84]);
const deltaFrame = annexB([0x41, 0x9a, 0x20]);

const rbd1 = ({ sequence, timestampUs, config = false, key = false, data }) => {
  const buffer = new ArrayBuffer(24 + data.byteLength);
  const bytes = new Uint8Array(buffer);
  bytes.set([0x52, 0x42, 0x44, 0x31, 1, 1]);
  const view = new DataView(buffer);
  view.setUint16(6, (config ? 1 : 0) | (key ? 2 : 0));
  view.setUint32(8, sequence);
  view.setBigUint64(12, BigInt(timestampUs));
  view.setUint32(20, data.byteLength);
  bytes.set(data, 24);
  return buffer;
};

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static instances = [];

  constructor() {
    this.readyState = FakeWebSocket.CONNECTING;
    this.listeners = new Map();
    this.closeCalls = [];
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  emit(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  send() {}

  close(code, reason) {
    this.closeCalls.push({ code, reason });
    this.readyState = FakeWebSocket.CLOSED;
  }
}

const flush = async () => {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
};

test("Firefox worker emits native fMP4 segments without constructing VideoDecoder", async (t) => {
  const posted = [];
  globalThis.VideoDecoder = class {
    constructor() {
      throw new Error("MSE path must not construct VideoDecoder");
    }
  };
  globalThis.WebSocket = FakeWebSocket;
  globalThis.postMessage = (message) => posted.push(message);
  globalThis.close = () => undefined;

  await import(
    new URL(
      "../dist/modules/display/viewer/assets/display-media-worker.js",
      import.meta.url,
    )
  );
  t.after(() => {
    globalThis.onmessage({ data: { type: "close" } });
  });

  globalThis.onmessage({
    data: {
      type: "init",
      url: "wss://example.test/rebroid/display/stream",
      canvas: {
        width: 0,
        height: 0,
        getContext: (type) =>
          type === "webgl2" ? null : { drawImage: () => undefined },
      },
      audio: false,
      renderer: "mse",
      effectiveProfile: {
        transport: "websocket",
        codec: "h264",
        maxSize: 0,
        maxFps: 60,
        bitrate: 16_000_000,
        iFrameInterval: 1,
        audio: false,
      },
    },
  });
  const socket = FakeWebSocket.instances.at(-1);
  socket.readyState = FakeWebSocket.OPEN;
  socket.emit("open");
  socket.emit("message", {
    data: rbd1({
      sequence: 0,
      timestampUs: 0,
      config: true,
      data: configuration,
    }),
  });
  socket.emit("message", {
    data: rbd1({
      sequence: 1,
      timestampUs: 1_000_000,
      key: true,
      data: keyFrame,
    }),
  });
  socket.emit("message", {
    data: rbd1({
      sequence: 2,
      timestampUs: 1_016_667,
      data: deltaFrame,
    }),
  });
  socket.emit("message", {
    data: rbd1({
      sequence: 3,
      timestampUs: 1_033_334,
      data: deltaFrame,
    }),
  });
  await flush();

  const initialization = posted.find((message) => message.type === "mse-init");
  const media = posted.find((message) => message.type === "mse-segment");
  assert.equal(initialization.codec, "avc1.42C033");
  assert.equal(initialization.width, 1080);
  assert.equal(initialization.height, 2340);
  assert.equal(media.samples.length, 2);
  assert.deepEqual(
    media.samples.map(({ sequence }) => sequence),
    [1, 2],
  );

  for (let attempt = 0; attempt < 3; attempt += 1) {
    globalThis.onmessage({
      data: { type: "mse-resync", reason: "source-buffer-test-error" },
    });
  }
  assert.equal(socket.closeCalls.length, 0);
  assert.equal(
    posted.some((message) => message.type === "renderer-fallback"),
    true,
  );
});
