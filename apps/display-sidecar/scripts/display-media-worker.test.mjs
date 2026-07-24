import assert from "node:assert/strict";
import test from "node:test";

const annexB = (...nals) =>
  Uint8Array.from(nals.flatMap((nal) => [0, 0, 0, 1, ...nal]));
const configuration = annexB(
  [0x67, 0x42, 0xe0, 0x1f],
  [0x68, 0xce, 0x06, 0xe2],
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

class FakeEncodedVideoChunk {
  constructor(init) {
    Object.assign(this, init);
  }
}

class FakeVideoDecoder {
  static instances = [];

  static async isConfigSupported(config) {
    return { supported: true, config };
  }

  constructor(callbacks) {
    this.callbacks = callbacks;
    this.decodeQueueSize = 0;
    this.state = "unconfigured";
    FakeVideoDecoder.instances.push(this);
  }

  configure() {
    this.state = "configured";
  }

  decode(chunk) {
    this.callbacks.output({
      timestamp: chunk.timestamp,
      displayWidth: 1920,
      displayHeight: 1080,
      codedWidth: 1920,
      codedHeight: 1080,
      closed: false,
      close() {
        this.closed = true;
      },
    });
  }

  close() {
    this.state = "closed";
  }
}

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.listeners = new Map();
    this.sent = [];
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

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.emit("open");
  }

  send(payload) {
    this.sent.push(payload);
  }

  close(code, reason) {
    this.closeCalls.push({ code, reason });
    this.readyState = FakeWebSocket.CLOSED;
  }
}

const flush = async () => {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
};

test("media worker renders only the newest frame and recovers locally from backlog", async (t) => {
  const posted = [];
  const animationFrames = [];
  const draws = [];
  globalThis.VideoDecoder = FakeVideoDecoder;
  globalThis.EncodedVideoChunk = FakeEncodedVideoChunk;
  globalThis.WebSocket = FakeWebSocket;
  globalThis.postMessage = (message) => posted.push(message);
  globalThis.requestAnimationFrame = (callback) => {
    animationFrames.push(callback);
    return animationFrames.length;
  };
  globalThis.cancelAnimationFrame = () => undefined;
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
          type === "webgl2"
            ? null
            : { drawImage: (frame) => draws.push(frame) },
      },
      audio: false,
      renderer: "webcodecs",
      effectiveProfile: {
        transport: "websocket",
        codec: "h264",
        maxSize: 1080,
        maxFps: 60,
        bitrate: 8_000_000,
        iFrameInterval: 1,
        audio: false,
      },
    },
  });
  const socket = FakeWebSocket.instances.at(-1);
  socket.open();
  socket.emit("message", {
    data: rbd1({
      sequence: 0,
      timestampUs: 0,
      config: true,
      data: configuration,
    }),
  });
  await flush();
  socket.emit("message", {
    data: rbd1({
      sequence: 1,
      timestampUs: 1_000,
      key: true,
      data: keyFrame,
    }),
  });
  socket.emit("message", {
    data: rbd1({ sequence: 2, timestampUs: 17_667, data: deltaFrame }),
  });
  socket.emit("message", {
    data: rbd1({ sequence: 3, timestampUs: 34_334, data: deltaFrame }),
  });
  await flush();

  assert.equal(animationFrames.length, 1);
  animationFrames.shift()(performance.now());
  assert.equal(draws.length, 1);
  assert.equal(
    posted.filter((message) => message.type === "first-frame").length,
    1,
  );

  FakeVideoDecoder.instances.at(-1).decodeQueueSize = 4;
  socket.emit("message", {
    data: rbd1({ sequence: 4, timestampUs: 51_001, data: deltaFrame }),
  });
  await flush();
  assert.equal(socket.closeCalls.length, 0);
  assert.equal(
    socket.sent.some((payload) =>
      String(payload).includes("video-resync-request"),
    ),
    true,
  );

  socket.emit("message", { data: new ArrayBuffer(3) });
  await flush();
  assert.equal(socket.closeCalls.at(-1).code, 4000);
});
