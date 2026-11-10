import assert from "node:assert/strict";
import test from "node:test";
import { ScrcpyVideoResetWatchdog } from "./scrcpy-video-reset-watchdog";

test("repeated reset requests do not move the original deadline", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const watchdog = new ScrcpyVideoResetWatchdog();
  const expired = t.mock.fn();
  watchdog.start(expired);
  for (let second = 0; second < 2; second += 1) {
    t.mock.timers.tick(1_000);
    watchdog.start(expired);
    assert.equal(expired.mock.callCount(), 0);
  }
  t.mock.timers.tick(1_000);
  assert.equal(expired.mock.callCount(), 1);
});

test("only configuration followed by an IDR completes a reset", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const watchdog = new ScrcpyVideoResetWatchdog();
  const expired = t.mock.fn();
  watchdog.start(expired);
  assert.equal(watchdog.observe({ config: false, keyFrame: true }), false);
  assert.equal(watchdog.observe({ config: true, keyFrame: false }), false);
  assert.equal(watchdog.pending, true);
  assert.equal(watchdog.observe({ config: false, keyFrame: true }), true);
  t.mock.timers.tick(3_000);
  assert.equal(expired.mock.callCount(), 0);
});
