import assert from "node:assert/strict";
import test from "node:test";
import { ScrcpyStreamLiveness } from "./scrcpy-stream-liveness";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("times out when the stream never delivers a first keyframe", async () => {
  const reasons: string[] = [];
  const liveness = new ScrcpyStreamLiveness({
    firstKeyFrameTimeoutMs: 5,
    videoProgressTimeoutMs: 50,
    onTimeout: (reason) => reasons.push(reason),
  });

  liveness.start();
  liveness.recordVideoPacket({ config: false, keyFrame: false });
  await wait(20);

  assert.deepEqual(reasons, ["display stream first keyframe timed out"]);
});

test("times out when video progress stops after a keyframe", async () => {
  const reasons: string[] = [];
  const liveness = new ScrcpyStreamLiveness({
    firstKeyFrameTimeoutMs: 50,
    videoProgressTimeoutMs: 5,
    onTimeout: (reason) => reasons.push(reason),
  });

  liveness.start();
  liveness.recordVideoPacket({ config: false, keyFrame: true });
  await wait(20);

  assert.deepEqual(reasons, ["display stream video progress timed out"]);
});

test("does not time out after it is stopped", async () => {
  const reasons: string[] = [];
  const liveness = new ScrcpyStreamLiveness({
    firstKeyFrameTimeoutMs: 5,
    videoProgressTimeoutMs: 5,
    onTimeout: (reason) => reasons.push(reason),
  });

  liveness.start();
  liveness.stop();
  await wait(20);

  assert.deepEqual(reasons, []);
});
