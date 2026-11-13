import assert from "node:assert/strict";
import test from "node:test";
import { WebrtcIdlePresentation } from "../dist/modules/display/viewer/assets/webrtc-idle-presentation.js";
import { DisplaySizePresentationTracker } from "../dist/modules/display/viewer/assets/display-size-presentation.js";

test("rotation presentation ignores pre-recovery and old-size frames", () => {
  const tracker = new DisplaySizePresentationTracker();
  const portrait = { width: 1080, height: 2340 };
  const landscape = { width: 2340, height: 1080 };
  tracker.present(portrait, 10);
  tracker.beginRecovery(20);
  assert.equal(tracker.present(landscape, 19), false);
  assert.equal(tracker.present(portrait, 22), false);
  assert.equal(tracker.snapshot(), undefined);
  tracker.present(landscape, 38);
  tracker.present(landscape, 44);
  assert.deepEqual(tracker.snapshot(), {
    previous: portrait,
    current: landscape,
    elapsedMs: 18,
  });
  tracker.present(portrait, 100);
  assert.equal(tracker.snapshot().elapsedMs, undefined);
});

test("idle presentation acknowledges only the latest quiet RTP frame once", () => {
  const progress = new WebrtcIdlePresentation();
  const messages = [];
  const channel = {
    readyState: "open",
    bufferedAmount: 0,
    send: (message) => messages.push(JSON.parse(message)),
  };
  for (let frame = 0; frame <= 10; frame++) {
    progress.presented(frame * 9000, frame * 100);
    progress.sample(channel, frame * 100);
  }
  assert.deepEqual(messages, []);
  progress.sample(channel, 2000);
  progress.sample(channel, 3000);
  assert.deepEqual(messages, [
    { type: "video-frame-presented", rtpTimestamp: 90000 },
  ]);
  assert.deepEqual(progress.diagnostics(), { status: "sent", sentCount: 1 });
  progress.presented(0xffffffff, 10000);
  progress.sample(channel, 11000);
  assert.equal(messages[1].rtpTimestamp, 0xffffffff);
  assert.equal(progress.diagnostics().sentCount, 2);
  const nextAttempt = new WebrtcIdlePresentation();
  nextAttempt.sample(channel, 12000);
  assert.equal(messages.length, 2);
  assert.equal(nextAttempt.diagnostics().sentCount, 0);
});

test("idle acknowledgement falls back safely without metadata or a writable channel", () => {
  const progress = new WebrtcIdlePresentation();
  const messages = [];
  const channel = {
    readyState: "open",
    bufferedAmount: 0,
    send: (message) => messages.push(message),
  };
  assert.equal(progress.diagnostics().status, "waiting-for-frame");
  for (const timestamp of [undefined, NaN, -1, 1.5, 0x100000000]) {
    progress.presented(timestamp, 0);
    progress.sample(channel, 2000);
  }
  assert.equal(progress.diagnostics().status, "timestamp-unavailable");
  progress.presented(0, 0);
  assert.equal(progress.diagnostics().status, "waiting-for-quiet");
  progress.sample({ ...channel, readyState: "closed" }, 1000);
  assert.equal(progress.diagnostics().status, "channel-unavailable");
  progress.sample({ ...channel, bufferedAmount: 1 }, 1000);
  assert.equal(progress.diagnostics().status, "channel-buffered");
  progress.sample(
    {
      ...channel,
      send: () => {
        throw new Error("closed");
      },
    },
    1000,
  );
  assert.equal(progress.diagnostics().status, "send-failed");
  assert.equal(messages.length, 0);
  progress.sample(channel, 2000);
  assert.equal(progress.diagnostics().status, "sent");
  assert.equal(messages.length, 1);
  progress.presented(1, 3000);
  progress.sample(channel, 7000); // Do not acknowledge stale frames after a suspended tab wakes.
  assert.equal(progress.diagnostics().status, "window-expired");
  assert.equal(messages.length, 1);
});

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

test("reset diagnostics correlate completion and discard stale source/generation evidence", async () => {
  const { applyVideoRecoveryStatus } =
    await import("../dist/modules/display/viewer/assets/video-recovery-metrics.js");
  const ready = applyVideoRecoveryStatus(null, {
    type: "ready",
    sourceAttemptId: "source-a",
  });
  const request = {
    type: "video-reset",
    sourceAttemptId: "source-a",
    generation: 2,
    codecGeneration: 7,
    count: 2,
  };
  const pending = applyVideoRecoveryStatus(ready, request);
  assert.equal(pending.videoResetGeneration, 2);
  assert.equal(
    pending.sourceCodecGeneration,
    7,
    "codec generation is not a reset counter",
  );
  const completion = {
    ...request,
    type: "video-reset-complete",
    elapsedMs: 180,
  };
  assert.equal(
    applyVideoRecoveryStatus(pending, { ...completion, generation: 1 }),
    pending,
  );
  assert.equal(
    applyVideoRecoveryStatus(pending, {
      ...completion,
      sourceAttemptId: "old",
    }),
    pending,
  );
  const completed = applyVideoRecoveryStatus(pending, completion);
  assert.equal(completed.videoResetCompletedGeneration, 2);
  assert.equal(completed.videoResetElapsedMs, 180);
  const next = applyVideoRecoveryStatus(completed, {
    ...request,
    generation: 3,
    count: 3,
  });
  assert.equal(next.videoResetCompletedGeneration, undefined);
  assert.equal(next.videoResetElapsedMs, undefined);
  assert.equal(applyVideoRecoveryStatus(next, request), next);
  assert.equal(
    applyVideoRecoveryStatus(next, {
      ...completion,
      generation: 3,
      elapsedMs: Infinity,
    }),
    next,
  );
  const restarted = applyVideoRecoveryStatus(
    {
      ...next,
      consumerAttemptId: "consumer-a",
      negotiatedH264ProfileLevelId: "42c033",
      bridgePliCount: 6,
    },
    {
      type: "ready",
      sourceAttemptId: "source-b",
    },
  );
  assert.equal(restarted.consumerAttemptId, "consumer-a");
  assert.equal(restarted.negotiatedH264ProfileLevelId, "42c033");
  assert.equal(restarted.bridgePliCount, 6);
  assert.equal(restarted.videoResetGeneration, undefined);
  assert.equal(applyVideoRecoveryStatus(restarted, completion), restarted);
});
