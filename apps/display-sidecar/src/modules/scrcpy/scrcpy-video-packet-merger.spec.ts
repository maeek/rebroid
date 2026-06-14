import assert from "node:assert/strict";
import test from "node:test";
import type { ScrcpyPacket } from "./scrcpy-packet-parser";
import { ScrcpyVideoPacketMerger } from "./scrcpy-video-packet-merger";

const packet = (
  data: number[],
  overrides: Partial<ScrcpyPacket> = {},
): ScrcpyPacket => ({
  data: Buffer.from(data),
  timestampUs: 1n,
  config: false,
  keyFrame: false,
  ...overrides,
});

test("stores config packets and prepends them to the next media packet", () => {
  const merger = new ScrcpyVideoPacketMerger();

  assert.equal(merger.merge(packet([1, 2], { config: true })), null);
  assert.equal(merger.hasPendingConfig(), true);

  const merged = merger.merge(packet([3, 4], { keyFrame: true }));

  assert.deepEqual([...(merged?.data ?? [])], [1, 2, 3, 4]);
  assert.equal(merged?.keyFrame, true);
  assert.equal(merged?.config, false);
  assert.equal(merger.hasPendingConfig(), false);
});

test("replaces stale config packets before the next media packet", () => {
  const merger = new ScrcpyVideoPacketMerger();

  assert.equal(merger.merge(packet([1], { config: true })), null);
  assert.equal(merger.merge(packet([2], { config: true })), null);

  const merged = merger.merge(packet([3]));

  assert.deepEqual([...(merged?.data ?? [])], [2, 3]);
});

test("passes media packets through when no config is pending", () => {
  const merger = new ScrcpyVideoPacketMerger();
  const media = packet([5, 6]);

  assert.equal(merger.merge(media), media);
});
