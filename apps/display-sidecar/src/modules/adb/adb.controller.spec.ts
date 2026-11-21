import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { FastifyReply } from "fastify";
import { AdbController } from "./adb.controller";
import type { AdbService } from "./adb.service";
import type { AdbTextService } from "./adb-text.service";

test("live logcat uses a bounded command and cancels it when the client disconnects", async (t) => {
  const raw = new EventEmitter();
  const logcat = t.mock.fn(
    (_udid: string, _tail: number, options: { signal: AbortSignal }) =>
      new Promise<never>((_resolve, reject) => {
        options.signal.addEventListener(
          "abort",
          () => reject(new Error("cancelled")),
          { once: true },
        );
      }),
  );
  const controller = new AdbController(
    { logcat } as unknown as AdbService,
    {} as AdbTextService,
  );
  const reading = controller.logcat(
    "device",
    { raw } as unknown as FastifyReply,
    "9000",
  );
  const [udid, tail, options] = logcat.mock.calls[0].arguments;
  assert.equal(udid, "device");
  assert.equal(tail, 2000);
  assert.deepEqual(options, {
    signal: options.signal,
    timeoutMs: 7_000,
    maxOutputBytes: 256 * 1024,
  });
  raw.emit("close");
  await assert.rejects(reading, /cancelled/);
  assert.equal(raw.listenerCount("close"), 0);
});
