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

const rbd1 = ({
  sequence,
  timestampUs,
  kind = 1,
  config = false,
  key = false,
  discontinuity = false,
  data,
}) => {
  const buffer = new ArrayBuffer(24 + data.byteLength);
  const bytes = new Uint8Array(buffer);
  bytes.set([0x52, 0x42, 0x44, 0x31, 1, kind]);
  const view = new DataView(buffer);
  view.setUint16(6, (config ? 1 : 0) | (key ? 2 : 0) | (discontinuity ? 4 : 0));
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

async function startWebCodecsWorker(t, name, overrides = {}) {
  const posted = [];
  globalThis.EncodedVideoChunk = FakeEncodedVideoChunk;
  globalThis.EncodedAudioChunk = FakeEncodedVideoChunk;
  globalThis.WebSocket = FakeWebSocket;
  globalThis.postMessage = (message) => posted.push(message);
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => undefined;
  globalThis.close = () => undefined;
  await import(
    new URL(
      `../dist/modules/display/viewer/assets/display-media-worker.js?${name}`,
      import.meta.url,
    )
  );
  t.after(() => globalThis.onmessage({ data: { type: "close" } }));
  globalThis.onmessage({
    data: {
      type: "init",
      url: "wss://example.test/rebroid/display/stream",
      canvas: {
        getContext: (type) => (type === "webgl2" ? null : { drawImage() {} }),
      },
      audio: false,
      renderer: "webcodecs",
      ...overrides,
    },
  });
  const socket = FakeWebSocket.instances.at(-1);
  socket.open();
  return { socket, posted };
}

function sendFrame(socket, sequence, data, flags = {}) {
  socket.emit("message", {
    data: rbd1({ sequence, timestampUs: 17_000 * sequence, data, ...flags }),
  });
}

for (const limit of ["frames", "bytes", "age"]) {
  test(`video ingress discards the queued GOP at its ${limit} limit`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const firstProbe = Promise.withResolvers();
    const decoded = [];
    let probeCount = 0;
    globalThis.VideoDecoder = class extends FakeVideoDecoder {
      static async isConfigSupported(config) {
        if (++probeCount === 1) await firstProbe.promise;
        return { supported: true, config };
      }

      decode(chunk) {
        decoded.push(chunk);
      }
    };
    const { socket } = await startWebCodecsWorker(t, `ingress-${limit}`);
    sendFrame(socket, 0, configuration, { config: true });
    sendFrame(socket, 1, keyFrame, { key: true });

    let sequence = 2;
    if (limit === "frames") {
      for (; sequence <= 9; sequence++) sendFrame(socket, sequence, deltaFrame);
    } else if (limit === "bytes") {
      const largeDelta = new Uint8Array(9 * 1024 * 1024);
      sendFrame(socket, sequence++, largeDelta);
      sendFrame(socket, sequence++, largeDelta);
    } else {
      sendFrame(socket, sequence++, deltaFrame);
      t.mock.timers.tick(151);
    }
    assert.equal(decoded.length, 0);
    const recovery = socket.sent.map(JSON.parse);
    assert.equal(recovery.length, 1);
    assert.equal(
      recovery[0].reason,
      limit === "age" ? "video-ingress-age" : "video-ingress-overflow",
    );

    sendFrame(socket, sequence++, deltaFrame);
    firstProbe.resolve();
    await flush();
    assert.equal(decoded.length, 0);

    const recoverySequence = sequence;
    sendFrame(socket, sequence++, keyFrame, { key: true });
    sendFrame(socket, sequence, deltaFrame);
    await flush();
    assert.deepEqual(
      decoded.map(({ timestamp, type }) => [timestamp, type]),
      [
        [recoverySequence * 17_000, "key"],
        [sequence * 17_000, "delta"],
      ],
    );
    assert.deepEqual(
      decoded[0].data,
      Uint8Array.from([...configuration, ...keyFrame]),
    );
    assert.deepEqual(socket.closeCalls, []);
  });
}

test("a stalled audio probe leaves video live and cannot affect a replacement connection", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const firstProbe = Promise.withResolvers();
  const videoTimestamps = [];
  const audioTimestamps = [];
  let audioChecks = 0;
  globalThis.VideoDecoder = class extends FakeVideoDecoder {
    decode(chunk) {
      videoTimestamps.push(chunk.timestamp);
    }
  };
  globalThis.AudioDecoder = class {
    static async isConfigSupported(config) {
      if (++audioChecks === 1) await firstProbe.promise;
      return { supported: true, config };
    }
    configure() {
      this.state = "configured";
    }
    decode(chunk) {
      audioTimestamps.push(chunk.timestamp);
    }
    close() {
      this.state = "closed";
    }
  };
  const { socket, posted } = await startWebCodecsWorker(t, "audio-reconnect", {
    audio: true,
    audioPort: {
      postMessage() {},
      start() {},
      close() {},
      addEventListener() {},
    },
  });
  const opus = Uint8Array.from([0xf8, 0xff, 0xfe]);
  sendFrame(socket, 0, opus, { kind: 2 });
  sendFrame(socket, 0, configuration, { config: true });
  sendFrame(socket, 1, keyFrame, { key: true });
  await flush();
  assert.deepEqual(videoTimestamps, [17_000]);
  assert.deepEqual(audioTimestamps, []);

  socket.emit("close", { code: 1006 });
  t.mock.timers.tick(300);
  const replacement = FakeWebSocket.instances.at(-1);
  assert.notEqual(replacement, socket);
  replacement.open();
  sendFrame(replacement, 0, keyFrame, { key: true });
  await flush();
  assert.deepEqual(videoTimestamps, [17_000]);
  sendFrame(replacement, 1, configuration, { config: true });
  sendFrame(replacement, 2, keyFrame, { key: true });
  sendFrame(replacement, 1, opus, { kind: 2 });
  await flush();
  assert.deepEqual(videoTimestamps, [17_000, 34_000]);
  assert.deepEqual(audioTimestamps, [17_000]);

  firstProbe.reject(new Error("probe from closed connection"));
  await flush();
  assert.equal(posted.filter(({ type }) => type === "reconnecting").length, 1);
  assert.equal(
    posted.some(({ payload }) => payload?.type === "audio-disabled"),
    false,
  );
  assert.deepEqual(replacement.closeCalls, []);
});

test("media worker renders only the newest frame and recovers locally from backlog", async (t) => {
  const posted = [];
  const animationFrames = [];
  const draws = [];
  FakeVideoDecoder.instances = [];
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
      discontinuity: true,
      data: configuration,
    }),
  });
  await flush();
  socket.emit("message", {
    data: rbd1({
      sequence: 1,
      timestampUs: 1_000,
      key: true,
      discontinuity: true,
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

  assert.equal(FakeVideoDecoder.instances.length, 1);
  assert.deepEqual(socket.sent, []);
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

test("a discontinuous IDR without configuration requests a resync", async (t) => {
  globalThis.WebSocket = FakeWebSocket;
  globalThis.postMessage = () => undefined;
  globalThis.close = () => undefined;
  await import(
    new URL(
      "../dist/modules/display/viewer/assets/display-media-worker.js?missing-config",
      import.meta.url,
    )
  );
  t.after(() => globalThis.onmessage({ data: { type: "close" } }));
  globalThis.onmessage({
    data: {
      type: "init",
      url: "wss://example.test/rebroid/display/stream",
      canvas: {},
      audio: false,
      renderer: "mse",
    },
  });
  const socket = FakeWebSocket.instances.at(-1);
  socket.open();
  socket.emit("message", {
    data: rbd1({
      sequence: 0,
      timestampUs: 1_000,
      key: true,
      discontinuity: true,
      data: keyFrame,
    }),
  });
  await flush();
  const [request] = socket.sent.map((message) => JSON.parse(message));
  assert.equal(request?.type, "video-resync-request");
  assert.equal(request?.reason, "rbd1-discontinuity");
});

test("an expired WebSocket session stops retrying the stale grant", async (t) => {
  const posted = [];
  globalThis.WebSocket = FakeWebSocket;
  globalThis.postMessage = (message) => posted.push(message);
  globalThis.close = () => undefined;
  await import(
    new URL(
      "../dist/modules/display/viewer/assets/display-media-worker.js?expired",
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
      canvas: {},
      audio: false,
      renderer: "mse",
    },
  });
  const socket = FakeWebSocket.instances.at(-1);
  socket.open();
  socket.emit("close", { code: 4404 });
  assert.equal(
    posted.some(({ type }) => type === "session-expired"),
    true,
  );
  assert.equal(
    posted.some(({ type }) => type === "reconnecting"),
    false,
  );
});

for (const failure of [
  "none",
  "missing",
  "unsupported",
  "configure",
  "decode",
  "callback",
]) {
  test(`audio ${failure}: forwards PCM or reports one local failure without reconnecting video`, async (t) => {
    const posted = [];
    const audioMessages = [];
    let supportChecks = 0;
    class FakeAudioDecoder {
      static async isConfigSupported(config) {
        supportChecks += 1;
        return { supported: failure !== "unsupported", config };
      }
      constructor(callbacks) {
        this.callbacks = callbacks;
        this.state = "unconfigured";
        this.decodeQueueSize = 0;
      }
      configure() {
        if (failure === "configure")
          throw new Error("audio configuration rejected");
        this.state = "configured";
      }
      decode(chunk) {
        if (failure === "decode") throw new Error("audio packet rejected");
        if (failure === "callback")
          this.callbacks.error(new Error("audio decoder stopped"));
        if (failure === "none")
          this.callbacks.output({
            timestamp: chunk.timestamp,
            sampleRate: 48_000,
            numberOfChannels: 2,
            numberOfFrames: 960,
            copyTo(plane) {
              plane.fill(0.25);
            },
            close() {},
          });
      }
      close() {
        this.state = "closed";
      }
    }
    globalThis.AudioDecoder =
      failure === "missing" ? undefined : FakeAudioDecoder;
    globalThis.EncodedAudioChunk = FakeEncodedVideoChunk;
    globalThis.WebSocket = FakeWebSocket;
    globalThis.postMessage = (message) => posted.push(message);
    globalThis.close = () => undefined;
    await import(
      new URL(
        `../dist/modules/display/viewer/assets/display-media-worker.js?audio-${failure}`,
        import.meta.url,
      )
    );
    t.after(() => globalThis.onmessage({ data: { type: "close" } }));
    globalThis.onmessage({
      data: {
        type: "init",
        url: "wss://example.test/rebroid/display/stream",
        canvas: {},
        audio: true,
        audioPort: {
          postMessage(message) {
            audioMessages.push(message);
          },
          start() {},
          close() {},
          addEventListener() {},
        },
        renderer: "mse",
      },
    });
    const socket = FakeWebSocket.instances.at(-1);
    socket.open();
    for (const sequence of [0, 1]) {
      socket.emit("message", {
        data: rbd1({
          sequence,
          kind: 2,
          timestampUs: 20_000 * sequence,
          data: Uint8Array.from([0xf8, 0xff, 0xfe]),
        }),
      });
      await flush();
    }
    assert.deepEqual(socket.closeCalls, []);
    assert.equal(
      posted.some(({ type }) => type === "reconnecting"),
      false,
    );
    const failures = posted.filter(
      ({ payload }) => payload?.type === "audio-disabled",
    );
    assert.equal(failures.length, failure === "none" ? 0 : 1);
    if (failure !== "none") assert.match(failures[0].payload.message, /audio/i);
    const pcm = audioMessages.filter(({ type }) => type === "pcm");
    assert.equal(pcm.length, failure === "none" ? 2 : 0);
    if (failure === "none") {
      assert.deepEqual(
        pcm.map(({ timestampUs }) => timestampUs),
        [0, 20_000],
      );
      assert.equal(new Float32Array(pcm[0].planes[0])[0], 0.25);
    }
    assert.equal(supportChecks, failure === "missing" ? 0 : 1);
    socket.emit("message", { data: JSON.stringify({ type: "heartbeat" }) });
    await flush();
    assert.deepEqual(socket.closeCalls, []);
  });
}

// Replay the observed failure: an initial GOP renders, then only heartbeat and
// relay metrics arrive while the source continues producing video.
async function startProgressReplay(t, name) {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  let now = 100;
  t.mock.method(performance, "now", () => now);
  globalThis.VideoDecoder = FakeVideoDecoder;
  const { socket, posted } = await startWebCodecsWorker(t, name, {
    effectiveProfile: { transport: "websocket", codec: "h264", maxFps: 60 },
  });
  const animationFrames = [];
  globalThis.requestAnimationFrame = (callback) => {
    animationFrames.push(callback);
    return animationFrames.length;
  };
  const draw = () =>
    animationFrames.splice(0).forEach((callback) => callback(now));
  sendFrame(socket, 0, configuration, { config: true });
  for (let sequence = 1; sequence <= 8; sequence++) {
    sendFrame(socket, sequence, sequence === 1 ? keyFrame : deltaFrame, {
      key: sequence === 1,
    });
    await flush();
    draw();
  }
  assert.equal(posted.filter(({ type }) => type === "first-frame").length, 1);
  const advance = async ({ sourceFps = 58, receive, render = true } = {}) => {
    now += 500;
    socket.emit("message", { data: JSON.stringify({ type: "heartbeat" }) });
    if (sourceFps !== null) {
      socket.emit("message", {
        data: JSON.stringify({ type: "relay-metrics", metrics: { sourceFps } }),
      });
    }
    if (receive !== undefined) {
      sendFrame(socket, receive, deltaFrame);
      await flush();
      if (render) draw();
    }
    t.mock.timers.tick(500);
    await flush();
  };
  return { socket, posted, advance, draw };
}

test("replay: live heartbeats cannot hide stopped video delivery after the first GOP", async (t) => {
  const { socket, posted, advance, draw } = await startProgressReplay(
    t,
    "progress-replay",
  );
  for (let tick = 0; tick < 12; tick++) await advance();
  assert.equal(socket.closeCalls.length, 1, "stalled consumer must reconnect");
  assert.equal(posted.filter(({ type }) => type === "reconnecting").length, 1);
  assert.equal(
    posted.find(({ type }) => type === "reconnecting").cause.category,
    "video-progress",
  );
  assert.equal(
    socket.sent
      .map(JSON.parse)
      .filter(({ type }) => type === "video-resync-request").length,
    0,
  );
  const replacement = FakeWebSocket.instances.at(-1);
  assert.notEqual(replacement, socket);
  replacement.open();
  sendFrame(replacement, 100, configuration, { config: true });
  sendFrame(replacement, 101, keyFrame, { key: true });
  await flush();
  draw();
  sendFrame(replacement, 102, deltaFrame);
  await flush();
  draw();
  t.mock.timers.tick(1_000);
  assert.equal(
    posted.filter(({ type }) => type === "metrics").at(-1).metrics
      .highestPresentedSequence,
    102,
  );
  assert.deepEqual(replacement.closeCalls, []);
  assert.equal(
    posted.filter(({ type }) => type === "first-frame").length,
    2,
    "replacement reports viewer readiness again",
  );
});

for (const sourceFps of [0, null]) {
  test(`progress replay leaves idle or stale source evidence alone (${sourceFps})`, async (t) => {
    const { socket, advance } = await startProgressReplay(
      t,
      `progress-idle-${sourceFps}`,
    );
    await advance();
    for (let tick = 0; tick < 40; tick++) await advance({ sourceFps });
    assert.deepEqual(socket.closeCalls, []);
    assert.equal(
      socket.sent
        .map(JSON.parse)
        .filter(({ type }) => type === "video-resync-request").length,
      0,
    );
  });
}

test("progress replay repairs a stalled decoder once before reconnecting its consumer", async (t) => {
  const { socket, advance } = await startProgressReplay(t, "progress-decode");
  globalThis.VideoDecoder = class extends FakeVideoDecoder {
    decode() {}
  };
  FakeVideoDecoder.instances.at(-1).decode = () => {};
  for (let tick = 0; tick < 12; tick++) await advance({ receive: 9 + tick });
  const resyncs = () =>
    socket.sent
      .map(JSON.parse)
      .filter(({ type }) => type === "video-resync-request");
  assert.equal(resyncs().length, 1);
  assert.equal(resyncs()[0].reason, "video-decode-stalled");
  assert.deepEqual(socket.closeCalls, []);
  for (let tick = 12; tick < 20; tick++) await advance({ receive: 9 + tick });
  assert.equal(resyncs().length, 1);
  assert.equal(socket.closeCalls.length, 1);
});

test("progress replay does not reset a hidden renderer and starts a fresh window on return", async (t) => {
  const { socket, advance } = await startProgressReplay(t, "progress-hidden");
  globalThis.onmessage({ data: { type: "visibility", visible: false } });
  for (let tick = 0; tick < 20; tick++)
    await advance({ receive: 9 + tick, render: false });
  assert.deepEqual(socket.closeCalls, []);
  assert.equal(
    socket.sent
      .map(JSON.parse)
      .filter(({ type }) => type === "video-resync-request").length,
    0,
  );
  globalThis.onmessage({ data: { type: "visibility", visible: true } });
  for (let tick = 20; tick < 24; tick++) await advance({ receive: 9 + tick });
  assert.deepEqual(socket.closeCalls, []);
});

test("progress replay resumes after local repair without reconnecting healthy video", async (t) => {
  const { socket, advance, draw } = await startProgressReplay(
    t,
    "progress-repaired",
  );
  FakeVideoDecoder.instances.at(-1).decode = () => {};
  for (let tick = 0; tick < 12; tick++) await advance({ receive: 9 + tick });
  const resyncs = () =>
    socket.sent
      .map(JSON.parse)
      .filter(({ type }) => type === "video-resync-request");
  assert.equal(resyncs().length, 1);
  sendFrame(socket, 21, keyFrame, { key: true });
  await flush();
  draw();
  for (let tick = 0; tick < 24; tick++) await advance({ receive: 22 + tick });
  assert.equal(resyncs().length, 1);
  assert.deepEqual(socket.closeCalls, []);
});

test("progress replay fences old socket status after a reconnect and honors expired grants", async (t) => {
  const { socket, posted, advance } = await startProgressReplay(
    t,
    "progress-expired",
  );
  for (let tick = 0; tick < 12; tick++) await advance();
  const replacement = FakeWebSocket.instances.at(-1);
  replacement.open();
  replacement.emit("close", { code: 4404 });
  for (let tick = 0; tick < 40; tick++) await advance();
  assert.equal(posted.filter(({ type }) => type === "reconnecting").length, 1);
  assert.equal(
    posted.filter(({ type }) => type === "session-expired").length,
    1,
  );
  assert.equal(FakeWebSocket.instances.at(-1), replacement);
});
