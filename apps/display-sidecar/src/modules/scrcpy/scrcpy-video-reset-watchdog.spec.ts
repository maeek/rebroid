import assert from "node:assert/strict";
import test from "node:test";
import { ScrcpyVideoResetWatchdog } from "./scrcpy-video-reset-watchdog";
import { ScrcpyService } from "./scrcpy.service";
import { ScrcpySourceStream } from "./scrcpy-source-stream";
import type { ScrcpySocket } from "./scrcpy.types";

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

test("a reset waits for control dispatch and cannot restart a later control socket", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 5_000 });
  const scrcpy = new ScrcpyService({} as never, {} as never);
  const stream = new ScrcpySourceStream(
    () => undefined,
    () => undefined,
    () => true,
  );
  const source = {
    profileKey: "fixture",
    stream,
    idleTimer: null,
    resetTimer: null,
    resetWatchdog: new ScrcpyVideoResetWatchdog(),
    resetPending: false,
    resetReason: "",
    resetGeneration: 0,
    resetCount: 0,
    lastResetAt: 0,
  };
  let dispatched!: () => void;
  const socket = {
    destroyed: false,
    writable: true,
    write: (payload: Buffer, callback: () => void) => {
      assert.deepEqual(payload, Buffer.from([17]));
      dispatched = callback;
      return true;
    },
  } as unknown as ScrcpySocket;
  const stopAttempt = t.mock.fn(async () => undefined);
  const active = {
    socket,
    udid: "fixture",
    stopAttempt,
    captureReady: true,
    resetDispatchPending: false,
  };
  scrcpy["sources"].set("display", source);
  scrcpy["controlSockets"].set("display", active);
  assert.equal(scrcpy.requestVideoReset("display", "test"), true);
  t.mock.timers.tick(2_900);
  assert.equal(source.resetWatchdog.pending, false);
  dispatched();
  await Promise.resolve();
  assert.equal(source.resetWatchdog.pending, true);
  assert.equal(source.resetCount, 1);
  t.mock.timers.tick(2_900);
  assert.equal(stopAttempt.mock.callCount(), 0);
  scrcpy["controlSockets"].set("display", { ...active });
  t.mock.timers.tick(100);
  assert.equal(stopAttempt.mock.callCount(), 0);
});
