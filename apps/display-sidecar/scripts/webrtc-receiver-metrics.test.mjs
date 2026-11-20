import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateWebrtcIntervalMetrics,
  readWebrtcReceiverStats,
} from "../dist/modules/display/viewer/assets/webrtc-receiver-metrics.js";

const previousSample = {
  receiver: {
    bytesReceived: 250_000,
    framesReceived: 20,
    framesDecoded: 18,
    jitterBufferDelay: 1,
    jitterBufferEmittedCount: 20,
  },
  presentedFrames: 17,
  droppedFrames: 2,
  sampledAt: 1_000,
};

test("WebRTC samples local video counters and calculates interval metrics", () => {
  const stats = [
    {
      type: "inbound-rtp",
      kind: "video",
      bytesReceived: 500_000,
      framesReceived: 40,
      framesDecoded: 36,
      framesDropped: 4,
      packetsLost: 0,
      nackCount: 3,
      pliCount: 1,
      jitter: 0.015,
      jitterBufferDelay: 1.5,
      jitterBufferEmittedCount: 40,
    },
    { type: "inbound-rtp", kind: "audio", bytesReceived: 25 },
    {
      type: "inbound-rtp",
      kind: "video",
      isRemote: true,
      bytesReceived: 10,
    },
    { type: "candidate-pair", selected: true, currentRoundTripTime: 0.04 },
    { type: "candidate-pair", currentRoundTripTime: 0.1 },
  ];
  const sample = readWebrtcReceiverStats(stats, previousSample.receiver);

  assert.equal(sample.packetsLost, 0);
  assert.equal(sample.nackCount, 3);
  assert.equal(sample.pliCount, 1);
  assert.equal(sample.networkJitterMs, 15);
  assert.equal(sample.roundTripTimeMs, 40);
  assert.equal(previousSample.receiver.bytesReceived, 250_000);
  assert.deepEqual(
    calculateWebrtcIntervalMetrics(previousSample, {
      receiver: sample.receiver,
      droppedFrames: sample.droppedFrames,
      presentedFrames: 33,
      sampledAt: 3_000,
    }),
    {
      receivedFps: 10,
      decodedFps: 9,
      presentedFps: 8,
      wireBitrateMbps: 1,
      jitterQueueDepthMs: 25,
      droppedFramesDelta: 2,
    },
  );
});

test("WebRTC carries cumulative counters across partial reports", () => {
  const sample = readWebrtcReceiverStats(
    [
      {
        type: "inbound-rtp",
        kind: "video",
        bytesReceived: Number.POSITIVE_INFINITY,
        framesReceived: 21,
        framesDecoded: "19",
        framesDropped: Number.NaN,
      },
      { type: "remote-inbound-rtp", roundTripTime: 0.05 },
    ],
    previousSample.receiver,
  );

  assert.deepEqual(sample.receiver, {
    ...previousSample.receiver,
    framesReceived: 21,
  });
  assert.equal(sample.droppedFrames, undefined);
  assert.equal(sample.networkJitterMs, undefined);
  assert.equal(sample.roundTripTimeMs, 50);
});

test("WebRTC bounds zero elapsed time and ignores a reset drop counter", () => {
  const metrics = calculateWebrtcIntervalMetrics(previousSample, {
    receiver: { ...previousSample.receiver, framesReceived: 21 },
    droppedFrames: 0,
    sampledAt: previousSample.sampledAt,
  });

  assert.deepEqual(metrics, {
    receivedFps: 1_000,
    decodedFps: 0,
    presentedFps: undefined,
    wireBitrateMbps: 0,
    jitterQueueDepthMs: undefined,
    droppedFramesDelta: 0,
  });
});
