import assert from "node:assert/strict";
import test from "node:test";
import type { ScrcpyPacket } from "./scrcpy-packet-parser";
import type { ScrcpyAudioPacket } from "./scrcpy.types";
import { BoundedAudioQueue, GopAwareVideoQueue } from "./scrcpy-media-queue";

const packet = (
  timestampUs: bigint,
  overrides: Partial<ScrcpyPacket> = {},
): ScrcpyPacket => ({
  data: Buffer.from([Number(timestampUs % 256n)]),
  timestampUs,
  config: false,
  keyFrame: false,
  ...overrides,
});

const audioPacket = (timestampUs: bigint): ScrcpyAudioPacket => ({
  data: Buffer.from([1]),
  timestampUs,
  config: false,
});

const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve));
const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

test("drops a congested GOP and resumes with cached config plus an IDR", async () => {
  const written: Array<{ timestampUs: bigint; config: boolean; gap: boolean }> =
    [];
  let releaseFirst!: () => void;
  const firstWrite = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let writes = 0;
  const queue = new GopAwareVideoQueue(
    async (value, gap) => {
      written.push({
        timestampUs: value.timestampUs,
        config: value.config,
        gap,
      });
      writes += 1;
      if (writes === 1) {
        await firstWrite;
      }
    },
    () => undefined,
  );

  queue.push(packet(0n, { config: true }));
  queue.push(packet(1_000n, { keyFrame: true }));
  queue.push(packet(17_667n));
  queue.push(packet(34_334n));
  queue.push(packet(51_001n));
  queue.push(packet(67_668n));

  assert.equal(queue.snapshot().awaitingKeyFrame, true);
  assert.ok(queue.snapshot().droppedFrames >= 4);

  releaseFirst();
  await nextTurn();
  queue.push(packet(84_335n, { keyFrame: true }));
  await nextTurn();

  assert.deepEqual(
    written.slice(-2).map(({ config, gap }) => ({ config, gap })),
    [
      { config: true, gap: true },
      { config: false, gap: true },
    ],
  );
  assert.equal(queue.snapshot().awaitingKeyFrame, false);
});

test("uses PTS span as a latency bound even below three frames", async () => {
  let releaseFirst!: () => void;
  const firstWrite = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let writes = 0;
  const queue = new GopAwareVideoQueue(
    async () => {
      writes += 1;
      if (writes === 1) {
        await firstWrite;
      }
    },
    () => undefined,
  );

  queue.push(packet(0n, { keyFrame: true }));
  queue.push(packet(10_000n));
  queue.push(packet(100_000n));

  assert.equal(queue.snapshot().awaitingKeyFrame, true);
  releaseFirst();
  await nextTurn();
});

test("fails recovery only after delta-frame PTS advances past the limit", async () => {
  let releaseFirst!: () => void;
  const firstWrite = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const recoveryErrors: Error[] = [];
  let writes = 0;
  const queue = new GopAwareVideoQueue(
    async () => {
      writes += 1;
      if (writes === 1) {
        await firstWrite;
      }
    },
    () => undefined,
    {
      keyFrameRecoveryTimeoutMs: 5,
      onRecoveryTimeout: (error) => recoveryErrors.push(error),
    },
  );

  queue.push(packet(0n, { keyFrame: true }));
  queue.push(packet(10_000n));
  queue.push(packet(100_000n));
  await wait(20);

  assert.equal(recoveryErrors.length, 0);
  queue.push(packet(106_000n));

  assert.equal(recoveryErrors.length, 1);
  assert.match(recoveryErrors[0]!.message, /PTS advanced/);
  let pushError: Error | undefined;
  queue.push(packet(120_000n, { keyFrame: true }), (error) => {
    pushError = error;
  });
  assert.match(pushError?.message ?? "", /media queue is closed/);
  releaseFirst();
  await nextTurn();
});

test("marks the first retained audio packet after latency trimming", async () => {
  const written: Array<{ timestampUs: bigint; discontinuity: boolean }> = [];
  let releaseFirst!: () => void;
  const firstWrite = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let writes = 0;
  const queue = new BoundedAudioQueue(async (value, discontinuity) => {
    written.push({ timestampUs: value.timestampUs, discontinuity });
    writes += 1;
    if (writes === 1) {
      await firstWrite;
    }
  });

  queue.push(audioPacket(0n));
  queue.push(audioPacket(20_000n));
  queue.push(audioPacket(140_000n));
  releaseFirst();
  await nextTurn();

  assert.deepEqual(written, [
    { timestampUs: 0n, discontinuity: false },
    { timestampUs: 140_000n, discontinuity: true },
  ]);
  assert.ok(queue.snapshot().droppedFrames >= 1);
});

test("marks the first retained audio packet after video resync", async () => {
  const written: Array<{ timestampUs: bigint; discontinuity: boolean }> = [];
  let releaseFirst!: () => void;
  const firstWrite = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let writes = 0;
  const queue = new BoundedAudioQueue(async (value, discontinuity) => {
    written.push({ timestampUs: value.timestampUs, discontinuity });
    writes += 1;
    if (writes === 1) {
      await firstWrite;
    }
  });

  queue.push(audioPacket(0n));
  queue.push(audioPacket(20_000n));
  queue.push(audioPacket(80_000n));
  queue.discardBefore(50_000n);
  releaseFirst();
  await nextTurn();

  assert.deepEqual(written, [
    { timestampUs: 0n, discontinuity: false },
    { timestampUs: 80_000n, discontinuity: true },
  ]);
  assert.ok(queue.snapshot().droppedFrames >= 1);
});
