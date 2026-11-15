import assert from "node:assert/strict";
import test from "node:test";
import { createRelayMetricsSampler } from "./display-relay-metrics";

test("relay metrics sample deltas per consumer and preserve sink diagnostics", () => {
  const sample = createRelayMetricsSampler(0);
  const queue = {
    queuedFrames: 1,
    queuedBytes: 300,
    queueDepthMs: 16,
    droppedFrames: 3,
    awaitingKeyFrame: false,
  };
  const snapshot = {
    sourceVideoFrames: 60,
    sourceVideoBytes: 1_000_000,
    lastKeyFrameBytes: 400,
    sourceFrameSizeP95Bytes: 200,
    sourceInterFrameP95Ms: 17,
    video: queue,
    audio: queue,
    scrcpyReadToSinkWriteP95Ms: 2,
    scrcpyReadToSinkWriteP99Ms: 4,
    eventLoopUtilization: 0.1,
    gcPauseP95Ms: 1,
  };
  assert.deepEqual(sample(snapshot, 1_000), {
    sourceFps: 60,
    sourceBitrateMbps: 8,
    sourceFrameSizeP95Bytes: 200,
    keyFrameSizeBytes: 400,
    sourceInterFrameP95Ms: 17,
    droppedFrames: 3,
    queueDepthMs: 16,
    relayP95Ms: 2,
    relayP99Ms: 4,
    eventLoopUtilization: 0.1,
    gcPauseP95Ms: 1,
  });
  const next = {
    ...snapshot,
    sourceVideoFrames: 90,
    sourceVideoBytes: 1_250_000,
  };
  const metrics = sample(next, 1_500);
  assert.equal(metrics.sourceFps, 60);
  assert.equal(metrics.sourceBitrateMbps, 4);
  assert.equal(createRelayMetricsSampler(1_000)(next, 1_500).sourceFps, 180);
});
