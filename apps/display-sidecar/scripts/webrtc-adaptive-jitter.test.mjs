import assert from "node:assert/strict";
import test from "node:test";

import { AdaptiveJitterBufferController } from "../dist/modules/display/viewer/assets/webrtc-stream.js";

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
