import assert from "node:assert/strict";
import test from "node:test";

class FakeSourceBuffer {
  constructor() {
    this.appended = [];
    this.listeners = new Map();
    this.updating = false;
    this.buffered = {
      length: 0,
      start: () => 0,
      end: () => 0,
    };
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  appendBuffer(buffer) {
    this.appended.push(buffer);
    this.updating = true;
  }

  completeAppend() {
    this.updating = false;
    for (const listener of this.listeners.get("updateend") ?? []) {
      listener();
    }
  }

  abort() {
    this.updating = false;
  }

  remove() {}
}

class FakeMediaSource {
  static instances = [];

  static isTypeSupported() {
    return true;
  }

  constructor() {
    this.listeners = new Map();
    this.readyState = "closed";
    this.sourceBuffer = new FakeSourceBuffer();
    FakeMediaSource.instances.push(this);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push({ listener, once: false });
    this.listeners.set(type, listeners);
  }

  addSourceBuffer() {
    return this.sourceBuffer;
  }

  open() {
    this.readyState = "open";
    for (const entry of this.listeners.get("sourceopen") ?? []) {
      entry.listener();
    }
  }

  endOfStream() {
    this.readyState = "ended";
  }
}

const createVideo = () => ({
  srcObject: null,
  src: "",
  muted: false,
  autoplay: false,
  playsInline: false,
  currentTime: 0,
  readyState: 0,
  videoWidth: 944,
  videoHeight: 2048,
  error: null,
  frameCallback: null,
  playCalls: 0,
  play() {
    this.playCalls += 1;
    return Promise.resolve();
  },
  pause() {},
  removeAttribute() {
    this.src = "";
  },
  load() {},
  requestVideoFrameCallback(callback) {
    this.frameCallback = callback;
    return 1;
  },
  cancelVideoFrameCallback() {},
  getVideoPlaybackQuality() {
    return { totalVideoFrames: 0, droppedVideoFrames: 0 };
  },
});

test("Firefox MSE batches VFR fragments without treating PTS gaps as append backlog", async () => {
  const originalMediaSource = globalThis.MediaSource;
  const originalWindow = globalThis.window;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  globalThis.MediaSource = FakeMediaSource;
  globalThis.window = globalThis;
  URL.createObjectURL = () => "blob:rebroid-test";
  URL.revokeObjectURL = () => undefined;

  try {
    const { MseVideoPlayer } = await import(
      new URL(
        "../dist/modules/display/viewer/assets/mse-video-player.js",
        import.meta.url,
      )
    );
    const video = createVideo();
    const resyncs = [];
    let firstFrames = 0;
    const player = new MseVideoPlayer(
      video,
      () => {
        firstFrames += 1;
      },
      (reason) => resyncs.push(reason),
    );

    player.initialize("avc1.42C029", new ArrayBuffer(16), 1_000_000);
    const mediaSource = FakeMediaSource.instances.at(-1);
    mediaSource.open();
    assert.equal(mediaSource.sourceBuffer.appended.length, 1);

    for (let index = 0; index < 10; index += 1) {
      player.appendMedia({
        segment: new ArrayBuffer(32),
        durationMs: 1_000,
        sourcePtsOriginUs: 1_000_000,
        samples: [
          {
            sequence: index + 1,
            timestampUs: 1_000_000 + index * 1_000_000,
          },
        ],
      });
    }
    assert.deepEqual(resyncs, []);

    mediaSource.sourceBuffer.completeAppend();
    assert.equal(mediaSource.sourceBuffer.appended.length, 2);
    assert.equal(mediaSource.sourceBuffer.appended[1].byteLength, 320);

    video.frameCallback(performance.now(), { mediaTime: 0 });
    assert.equal(firstFrames, 1);

    player.initialize("avc1.42C029", new ArrayBuffer(16), 2_000_000);
    video.frameCallback(performance.now(), { mediaTime: 0 });
    assert.equal(firstFrames, 2);
    player.close();
  } finally {
    globalThis.MediaSource = originalMediaSource;
    globalThis.window = originalWindow;
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  }
});
