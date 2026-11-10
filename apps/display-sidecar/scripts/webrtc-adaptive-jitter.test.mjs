import assert from "node:assert/strict";
import test from "node:test";

import {
  AdaptiveJitterBufferController,
  WebrtcPresentationProgress,
} from "../dist/modules/display/viewer/assets/webrtc-stream.js";

test("WebRTC detects frozen presentation while reception and decoding advance", () => {
  const progress = new WebrtcPresentationProgress();
  const sample = (frames, presented) =>
    progress.sample(
      { sourceVideoFrames: frames },
      presented,
      frames,
      frames,
      true,
    );
  sample(20, 20);
  assert.equal(sample(80, 20).freeze, false);
  assert.deepEqual(sample(140, 20), {
    freeze: true,
    stalled: false,
    idle: false,
  });
  assert.equal(sample(200, 20).stalled, true);
  assert.equal(sample(260, 21).stalled, false);
});

test("WebRTC progress samples do not combine stalls across an idle screen", () => {
  const progress = new WebrtcPresentationProgress();
  const sample = (frames, presented = 10) =>
    progress.sample(
      { sourceVideoFrames: frames },
      presented,
      frames,
      frames,
      true,
    );
  sample(10);
  assert.equal(sample(20).freeze, false);
  assert.equal(sample(20).idle, true);
  assert.equal(sample(21).freeze, false);
  assert.equal(sample(22, 11).stalled, false);
});

test("WebRTC with no presentation API still detects an upstream stall", () => {
  const progress = new WebrtcPresentationProgress();
  const sample = (frames, decoded) =>
    progress.sample(
      { sourceVideoFrames: frames },
      undefined,
      frames,
      decoded,
      true,
    );
  sample(10, 10);
  assert.equal(sample(20, 20).stalled, false);
  assert.equal(sample(30, 20).freeze, false);
  assert.equal(sample(40, 20).freeze, false);
  assert.equal(sample(50, 20).stalled, true);
});

test("an idle or hidden display does not accumulate WebRTC stalls", () => {
  const progress = new WebrtcPresentationProgress();
  const previous = { sourceVideoFrames: 10, sourceFps: 60 };
  progress.sample(previous, 10, 10, 10, true);
  for (let i = 0; i < 4; i += 1) {
    assert.equal(progress.sample(previous, 10, 10, 10, true).freeze, false);
    assert.equal(
      progress.sample({ sourceVideoFrames: 20 + i }, 10, 10, 10, false).stalled,
      false,
    );
  }
  assert.equal(
    progress.sample({ sourceVideoFrames: 23 }, 10, 10, 10, true).idle,
    true,
  );
});

test("adaptive jitter buffering stays within 20-40 ms", () => {
  const controller = new AdaptiveJitterBufferController();
  const receiver = { jitterBufferTarget: 0 };

  controller.add(receiver);
  assert.equal(controller.target(), 20);
  assert.equal(receiver.jitterBufferTarget, 20);

  controller.sample(45, 0);
  assert.equal(controller.target(), 30);
  controller.sample(20, 1);
  assert.equal(controller.target(), 40);
  controller.sample(80, 3);
  assert.equal(controller.target(), 40);

  for (let sample = 0; sample < 10; sample += 1) {
    controller.sample(20, 0);
  }
  assert.equal(controller.target(), 30);
  assert.equal(receiver.jitterBufferTarget, 30);

  for (let sample = 0; sample < 20; sample += 1) {
    controller.sample(20, 0);
  }
  assert.equal(controller.target(), 20);
  assert.equal(receiver.jitterBufferTarget, 20);
});

test("adaptive jitter buffering ignores unsupported receivers", () => {
  const controller = new AdaptiveJitterBufferController();
  const receiver = {};

  controller.add(receiver);
  controller.sample(50, 0);

  assert.equal(controller.target(), 30);
  assert.equal("jitterBufferTarget" in receiver, false);
});
