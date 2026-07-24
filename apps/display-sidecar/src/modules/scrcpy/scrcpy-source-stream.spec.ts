import assert from "node:assert/strict";
import test from "node:test";
import type { ScrcpyPacket } from "./scrcpy-packet-parser";
import { ScrcpySourceStream } from "./scrcpy-source-stream";
import type { ScrcpyMediaSink } from "./scrcpy.types";

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
  assert.equal(secondAttachment.requestVideoReset("test"), true);
  assert.equal(resetCount, 1);
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
