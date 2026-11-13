import assert from "node:assert/strict";
import test from "node:test";
import type { ScrcpyPacket } from "./scrcpy-packet-parser";
import { ScrcpySourceStream } from "./scrcpy-source-stream";
import type { ScrcpyMediaSink } from "./scrcpy.types";
import { QueuedScrcpyMediaSink } from "./scrcpy-media-sink";
import { setImmediate } from "node:timers/promises";

function fakeSink() {
  let open = true;
  const video: ScrcpyPacket[] = [];
  const closeListeners: Array<() => void> = [];
  const sink: ScrcpyMediaSink = {
    isOpen: () => open,
    onClose: (listener) => closeListeners.push(() => listener()),
    sendStatus: () => undefined,
    writeVideo: (packet, done) => {
      video.push(packet);
      done?.();
    },
    writeAudio: (_packet, done) => done?.(),
    snapshot: () => ({
      sourceVideoFrames: video.filter((packet) => !packet.config).length,
      video: {
        queuedFrames: 0,
        queuedBytes: 0,
        queueDepthMs: 0,
        droppedFrames: 0,
        awaitingKeyFrame: false,
      },
      audio: {
        queuedFrames: 0,
        queuedBytes: 0,
        queueDepthMs: 0,
        droppedFrames: 0,
        awaitingKeyFrame: false,
      },
    }),
    close: () => {
      if (!open) return;
      open = false;
      for (const listener of closeListeners) listener();
    },
  };
  return { sink, video };
}

const packet = (
  timestampUs: bigint,
  overrides: Partial<ScrcpyPacket> = {},
): ScrcpyPacket => ({
  data: Buffer.from([1, 2, 3]),
  timestampUs,
  config: false,
  keyFrame: false,
  ...overrides,
});

test("detaching and reattaching consumers preserves the source attempt", async () => {
  let emptyCount = 0;
  let resetCount = 0;
  const source = new ScrcpySourceStream(
    () => {
      emptyCount += 1;
    },
    () => undefined,
    () => {
      resetCount += 1;
      return true;
    },
  );
  const first = fakeSink();
  const firstAttachment = source.attach(first.sink);
  assert.equal(resetCount, 1);
  source.writeVideo(packet(0n, { config: true }));
  source.writeVideo(packet(1_000n, { keyFrame: true }));
  firstAttachment.detach();
  await firstAttachment.closed;

  const second = fakeSink();
  const secondAttachment = source.attach(second.sink);

  assert.equal(
    secondAttachment.sourceAttemptId,
    firstAttachment.sourceAttemptId,
  );
  assert.equal(source.isOpen(), true);
  assert.equal(emptyCount, 1);
  assert.deepEqual(
    second.video.map(({ config, keyFrame }) => ({ config, keyFrame })),
    [
      { config: true, keyFrame: false },
      { config: false, keyFrame: true },
    ],
  );
  assert.equal(resetCount, 1, "the warm attachment replays the cached GOP");
  assert.equal(secondAttachment.requestVideoReset("test"), true);
  assert.equal(resetCount, 2);
});

test("one failed consumer does not close another consumer", async () => {
  const source = new ScrcpySourceStream(
    () => undefined,
    () => undefined,
    () => true,
  );
  const first = fakeSink();
  const second = fakeSink();
  const firstAttachment = source.attach(first.sink);
  source.attach(second.sink);

  first.sink.close(1011, "failed");
  await firstAttachment.closed;
  source.writeVideo(packet(1_000n, { keyFrame: true }));

  assert.equal(source.consumerCount(), 1);
  assert.equal(second.video.length, 1);
  assert.equal(source.isOpen(), true);
});

test("a warm consumer skips an oversized cached GOP and starts at the next IDR", async () => {
  const source = new ScrcpySourceStream(
    () => undefined,
    () => undefined,
    () => true,
  );
  source.writeVideo(packet(0n, { config: true }));
  source.writeVideo(packet(1_000n, { keyFrame: true }));
  for (let i = 1n; i <= 5n; i += 1n) {
    source.writeVideo(packet(1_000n + i * 16_667n));
  }
  const delivered: number[] = [];
  const sink = new QueuedScrcpyMediaSink({
    isOpen: () => true,
    onClose: () => undefined,
    writeStatus: () => undefined,
    writeVideo: async (frame) => {
      delivered.push(frame.readUInt16BE(6));
    },
    writeAudio: async () => undefined,
    close: () => undefined,
  });
  const attachment = source.attach(sink);
  try {
    source.writeVideo(packet(101_000n));
    await setImmediate();
    assert.deepEqual(delivered, []);
    assert.equal(sink.snapshot().video.awaitingKeyFrame, true);
    source.writeVideo(packet(118_000n, { keyFrame: true }));
    source.writeVideo(packet(135_000n));
    await setImmediate();
    assert.deepEqual(delivered, [5, 6, 0]);
  } finally {
    attachment.detach();
  }
});

test("a cached GOP dropped under backpressure requests an IDR only if the consumer still needs one", async (t) => {
  for (const liveKeyFrame of [false, true]) {
    await t.test(liveKeyFrame ? "live IDR" : "live delta", async () => {
      let resets = 0;
      const source = new ScrcpySourceStream(
        () => undefined,
        () => undefined,
        () => {
          resets += 1;
          return true;
        },
      );
      source.writeVideo(packet(0n, { config: true }));
      source.writeVideo(packet(1_000n, { keyFrame: true }));
      source.writeVideo(packet(17_667n));
      source.writeVideo(packet(34_334n));

      let releaseWrite!: () => void;
      const writeBlocked = new Promise<void>((resolve) => {
        releaseWrite = resolve;
      });
      const sink = new QueuedScrcpyMediaSink({
        isOpen: () => true,
        onClose: () => undefined,
        writeStatus: () => undefined,
        writeVideo: () => writeBlocked,
        writeAudio: async () => undefined,
        close: () => undefined,
      });
      const attachment = source.attach(sink);
      try {
        assert.equal(resets, 0);
        source.writeVideo(packet(51_001n, { keyFrame: liveKeyFrame }));
        await Promise.resolve();
        assert.equal(sink.snapshot().video.awaitingKeyFrame, !liveKeyFrame);
        assert.equal(resets, liveKeyFrame ? 0 : 1);
      } finally {
        attachment.detach();
        releaseWrite();
      }
    });
  }
});

test("clipboard status reaches only the permitted browser consumer", () => {
  const source = new ScrcpySourceStream(
    () => undefined,
    () => undefined,
    () => true,
  );
  const attach = (allowClipboard: boolean) => {
    const statuses: string[] = [];
    const sink = new QueuedScrcpyMediaSink({
      allowClipboard,
      isOpen: () => true,
      onClose: () => undefined,
      writeStatus: (message) => statuses.push(message),
      writeVideo: async () => undefined,
      writeAudio: async () => undefined,
      close: () => undefined,
    });
    return { statuses, sink, attachment: source.attach(sink) };
  };
  const allowed = attach(true);
  const denied = attach(false);
  try {
    const clipboard = { type: "clipboard", text: "dummy clipboard value" };
    const ready = { type: "ready" };
    source.sendStatus(clipboard);
    source.sendStatus(ready);
    assert.deepEqual(allowed.statuses, [
      JSON.stringify(clipboard),
      JSON.stringify(ready),
    ]);
    assert.deepEqual(denied.statuses, [JSON.stringify(ready)]);
  } finally {
    for (const consumer of [allowed, denied]) {
      consumer.attachment.detach();
      consumer.sink.close();
    }
  }
});

test("video bootstrap waits for configuration plus IDR and reports the SPS profile", async () => {
  const source = new ScrcpySourceStream(
    () => undefined,
    () => undefined,
    () => true,
  );
  const consumer = fakeSink();
  const attachment = source.attach(consumer.sink);
  const bootstrapPromise = attachment.awaitVideoBootstrap(500);
  source.setActualEncoder("c2.android.avc.encoder");
  source.writeVideo(
    packet(10n, {
      config: true,
      data: Buffer.from([
        0, 0, 0, 1, 0x67, 0x42, 0xe0, 0x1f, 0, 0, 0, 1, 0x68, 0xce, 0x06, 0xe2,
      ]),
    }),
  );
  source.writeVideo(
    packet(20n, {
      keyFrame: true,
      data: Buffer.from([0, 0, 0, 1, 0x65, 0x88, 0x84]),
    }),
  );

  const bootstrap = await bootstrapPromise;
  assert.equal(bootstrap.profileLevelId, "42e01f");
  assert.match(bootstrap.sdpFmtpLine, /packetization-mode=1/);
  assert.equal(bootstrap.actualEncoder, "c2.android.avc.encoder");
  assert.equal(bootstrap.keyFrameTimestampUs, 20n);
});

test("a new configuration waits for its own IDR and never replays the old GOP", async () => {
  let resets = 0;
  const source = new ScrcpySourceStream(
    () => undefined,
    () => undefined,
    () => {
      resets += 1;
      return true;
    },
  );
  const config = (profileLevel: string) =>
    Buffer.from(`0000000167${profileLevel}0000000168ce06e2`, "hex");
  source.writeVideo(packet(10n, { config: true, data: config("42e01f") }));
  source.writeVideo(packet(20n, { keyFrame: true }));
  source.writeVideo(packet(30n, { config: true, data: config("42e020") }));
  source.writeVideo(packet(40n));

  const consumer = fakeSink();
  const attachment = source.attach(consumer.sink, { mode: "bootstrap" });
  assert.equal(resets, 1, "the previous generation cannot satisfy bootstrap");
  assert.deepEqual(
    consumer.video.map(({ timestampUs }) => timestampUs),
    [30n],
  );
  let resolved = false;
  const pending = attachment.awaitVideoBootstrap(500).then((bootstrap) => {
    resolved = true;
    return bootstrap;
  });
  await Promise.resolve();
  assert.equal(resolved, false);
  source.writeVideo(packet(50n, { keyFrame: true }));

  const bootstrap = await pending;
  assert.equal(bootstrap.profileLevelId, "42e020");
  assert.equal(bootstrap.keyFrameTimestampUs, 50n);
  const firstPeer = fakeSink();
  const secondPeer = fakeSink();
  assert.ok(bootstrap.attachMedia(firstPeer.sink));
  assert.ok(bootstrap.attachMedia(secondPeer.sink));
  assert.deepEqual(
    firstPeer.video.map(({ timestampUs }) => timestampUs),
    [30n, 50n],
  );
  assert.deepEqual(secondPeer.video, firstPeer.video);
  assert.equal(resets, 1, "the current IDR satisfies both media attachments");
});

test("a cached IDR answers a replacement offer while an oversized GOP needs a fresh IDR for media", async () => {
  let resets = 0;
  const source = new ScrcpySourceStream(
    () => undefined,
    () => undefined,
    () => {
      resets += 1;
      return true;
    },
  );
  source.writeVideo(
    packet(0n, {
      config: true,
      data: Buffer.from("000000016742e01f0000000168ce06e2", "hex"),
    }),
  );
  source.writeVideo(packet(1_000n, { keyFrame: true }));
  const first = source.attach(fakeSink().sink, { mode: "bootstrap" });
  const bootstrap = await first.awaitVideoBootstrap();
  for (let i = 1n; i <= 4n; i += 1n) {
    source.writeVideo(packet(1_000n + i * 16_667n));
  }

  const replacement = source.attach(fakeSink().sink, { mode: "bootstrap" });
  assert.equal(
    (await replacement.awaitVideoBootstrap()).keyFrameTimestampUs,
    1_000n,
  );
  assert.equal(resets, 0, "signaling can reuse the cached IDR");

  const peer = fakeSink();
  assert.ok(bootstrap.attachMedia(peer.sink));
  assert.deepEqual(
    peer.video.map(({ timestampUs }) => timestampUs),
    [0n],
  );
  assert.equal(
    resets,
    1,
    "media needs a fresh IDR after the GOP outgrew replay limits",
  );
});

test("a negotiated consumer stays attached across repeated configuration and detaches on a codec change", async () => {
  const source = new ScrcpySourceStream(
    () => undefined,
    () => undefined,
    () => true,
  );
  const config = (level: string) =>
    Buffer.from(`000000016742e0${level}0000000168ce06e2`, "hex");
  const bootstrapConsumer = fakeSink();
  const attachment = source.attach(bootstrapConsumer.sink);
  source.writeVideo(packet(10n, { config: true, data: config("1f") }));
  source.writeVideo(packet(20n, { keyFrame: true }));
  const bootstrap = await attachment.awaitVideoBootstrap();

  const peer = fakeSink();
  const other = fakeSink();
  source.attach(other.sink);
  const media = bootstrap.attachMedia(peer.sink);
  assert.ok(media);
  assert.deepEqual(
    peer.video.map(({ timestampUs }) => timestampUs),
    [10n, 20n],
  );

  source.writeVideo(packet(30n, { config: true, data: config("1f") }));
  assert.equal(bootstrap.isCurrent(), true);
  const betweenConfigAndIdr = fakeSink();
  assert.ok(bootstrap.attachMedia(betweenConfigAndIdr.sink));
  assert.deepEqual(
    betweenConfigAndIdr.video.map(({ timestampUs }) => timestampUs),
    [30n],
    "identical SPS/PPS still invalidates the previous GOP",
  );
  source.writeVideo(packet(40n, { keyFrame: true }));
  assert.equal(peer.sink.isOpen(), true);
  source.writeVideo(packet(50n, { config: true, data: config("20") }));
  assert.equal(peer.sink.isOpen(), false);
  await media.closed;
  assert.equal(peer.video.at(-1)?.timestampUs, 40n);
  assert.equal(other.video.at(-1)?.timestampUs, 50n);
  assert.equal(source.isOpen(), true);
});

test("live WebSocket overflow asks for one IDR and resumes without detaching either consumer", async () => {
  const resets: string[] = [];
  const source = new ScrcpySourceStream(
    () => undefined,
    () => undefined,
    (reason) => {
      resets.push(reason);
      return true;
    },
  );
  source.writeVideo(packet(0n, { config: true }));
  source.writeVideo(packet(1_000n, { keyFrame: true }));
  const sibling = source.attach(fakeSink().sink);
  const delivered: number[] = [];
  let blocked: Promise<void> | undefined;
  let releaseWrite!: () => void;
  const sink = new QueuedScrcpyMediaSink({
    isOpen: () => true,
    onClose: () => undefined,
    writeStatus: () => undefined,
    writeVideo: async (frame) => {
      delivered.push(frame.readUInt16BE(6));
      await blocked;
    },
    writeAudio: async () => undefined,
    onVideoKeyFrameNeeded: () =>
      attachment.requestVideoReset("websocket:consumer-queue-overflow"),
    close: () => undefined,
  });
  const attachment = source.attach(sink);
  try {
    await setImmediate();
    assert.deepEqual(delivered, [5, 6]);
    blocked = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    for (let step = 1n; step <= 12n; step++)
      source.writeVideo(packet(1_000n + step * 16_667n));
    await Promise.resolve();
    assert.deepEqual(resets, ["websocket:consumer-queue-overflow"]);
    releaseWrite();
    blocked = undefined;
    source.writeVideo(packet(220_000n, { keyFrame: true }));
    source.writeVideo(packet(237_000n));
    await setImmediate();
    assert.deepEqual(delivered, [5, 6, 0, 5, 6, 0]);
    assert.equal(source.consumerCount(), 2);
  } finally {
    releaseWrite?.();
    attachment.detach();
    sibling.detach();
  }
});
