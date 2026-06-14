import assert from "node:assert/strict";
import test from "node:test";
import type { ScrcpyPacket } from "./scrcpy-packet-parser";
import { ScrcpyVideoPacketForwarder } from "./scrcpy-video-packet-forwarder";

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

test("config packets are counted but not forwarded as media", () => {
  const forwarder = new ScrcpyVideoPacketForwarder();

  const result = forwarder.accept(packet([1, 2], { config: true }));

  assert.equal(result.packet, null);
  assert.equal(result.firstConfigPacket, true);
  assert.equal(result.firstMediaPacket, false);
  assert.equal(result.firstKeyFrame, false);
  assert.deepEqual(result.stats, {
    configPackets: 1,
    mediaPackets: 0,
    keyFrames: 0,
  });
});

test("prepends pending config to the first media keyframe", () => {
  const forwarder = new ScrcpyVideoPacketForwarder();

  forwarder.accept(packet([1, 2], { config: true }));
  const result = forwarder.accept(packet([3, 4], { keyFrame: true }));

  assert.deepEqual([...(result.packet?.data ?? [])], [1, 2, 3, 4]);
  assert.equal(result.configPrepended, true);
  assert.equal(result.firstConfigPacket, false);
  assert.equal(result.firstMediaPacket, true);
  assert.equal(result.firstKeyFrame, true);
  assert.deepEqual(result.stats, {
    configPackets: 1,
    mediaPackets: 1,
    keyFrames: 1,
  });
});

test("only reports first media and first keyframe once", () => {
  const forwarder = new ScrcpyVideoPacketForwarder();

  forwarder.accept(packet([1], { keyFrame: true }));
  const secondKeyFrame = forwarder.accept(packet([2], { keyFrame: true }));
  const delta = forwarder.accept(packet([3]));

  assert.equal(secondKeyFrame.firstMediaPacket, false);
  assert.equal(secondKeyFrame.firstKeyFrame, false);
  assert.equal(delta.firstMediaPacket, false);
  assert.equal(delta.firstKeyFrame, false);
  assert.deepEqual(delta.stats, {
    configPackets: 0,
    mediaPackets: 3,
    keyFrames: 2,
  });
});
