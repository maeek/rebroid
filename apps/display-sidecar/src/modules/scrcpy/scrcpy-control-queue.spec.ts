import assert from "node:assert/strict";
import test from "node:test";
import { ScrcpyControlDispatchError } from "./scrcpy-control-dispatch-error";
import {
  confirmScrcpyControlWrite,
  ScrcpyControlQueue,
} from "./scrcpy-control-queue";

test("a queued command resolves only after it is written", async () => {
  const queue = new ScrcpyControlQueue();
  const command = Buffer.from([1]);
  let dispatched = false;
  const delivery = queue.enqueue("session", [command]).then(() => {
    dispatched = true;
  });
  await Promise.resolve();
  assert.equal(dispatched, false);
  let confirm!: (value: true) => void;
  const dispatch = new Promise<true>((resolve) => {
    confirm = resolve;
  });
  assert.equal(
    queue.flush("session", (payloads) => {
      assert.deepEqual(payloads, [command]);
      return dispatch;
    }),
    1,
  );
  await Promise.resolve();
  assert.equal(dispatched, false);
  confirm(true);
  await delivery;
  assert.equal(dispatched, true);
});

test("a command that expires before reconnect is never replayed", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const queue = new ScrcpyControlQueue();
  const expired = assert.rejects(
    queue.enqueue("session", [Buffer.from([1])]),
    /did not reconnect in time/,
  );
  t.mock.timers.tick(3_000);
  await expired;
  assert.equal(
    queue.flush("session", () => assert.fail("replayed expired input")),
    0,
  );
});

test("reconnect hands off the original dispatch deadline", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const queue = new ScrcpyControlQueue();
  const deadline = Date.now() + 3_000;
  const queued = queue.enqueue("session", [Buffer.from([1])]);
  t.mock.timers.tick(2_900);
  queue.flush("session", (_payloads, expiresAt) => {
    assert.equal(expiresAt, deadline);
    assert.equal(expiresAt - Date.now(), 100);
    return Promise.resolve(true);
  });
  await queued;
});

test("a submitted write without timely confirmation reports an unknown outcome once", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  let confirm!: () => void;
  const complete = t.mock.fn<(error?: Error | null) => void>();
  confirmScrcpyControlWrite(
    Date.now() + 100,
    (written) => {
      confirm = written;
    },
    complete,
  );
  t.mock.timers.tick(99);
  assert.equal(complete.mock.callCount(), 0);
  t.mock.timers.tick(1);
  assert.equal(complete.mock.callCount(), 1);
  const error = complete.mock.calls[0]?.arguments[0];
  assert.ok(error instanceof ScrcpyControlDispatchError);
  assert.equal(error.code, "control_outcome_unknown");
  confirm();
  assert.equal(complete.mock.callCount(), 1);
});
