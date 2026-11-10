import assert from "node:assert/strict";
import test from "node:test";
import { ScrcpyControlQueue } from "./scrcpy-control-queue";

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
