import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { DisplayPublicController } from "./display-public.controller";
import type { DisplayControlRequest } from "./display.types";

test("offer cancellation follows premature response close through answer delivery", async () => {
  const signals: AbortSignal[] = [];
  const controller = new DisplayPublicController(
    {} as never,
    {} as never,
    {
      createAnswer: async ({ signal }: { signal: AbortSignal }) => {
        signals.push(signal);
        signal.throwIfAborted();
        return { sdp: "answer", consumerAttemptId: "attempt-1" };
      },
    } as never,
  );
  const headers: [string, string][] = [];
  const offer = (response: EventEmitter) =>
    controller.publicWebrtcOffer("session", { sdp: "offer" }, { headers: {} }, {
      raw: response,
      header: (name: string, value: string) => headers.push([name, value]),
    } as never);

  const closed = new EventEmitter();
  assert.deepEqual(await offer(closed), { sdp: "answer" });
  assert.deepEqual(headers, [["x-rebroid-webrtc-attempt", "attempt-1"]]);
  closed.emit("close");
  assert.equal(signals[0]!.aborted, true);
  assert.equal(closed.listenerCount("finish"), 0);

  const finished = new EventEmitter();
  assert.deepEqual(await offer(finished), { sdp: "answer" });
  finished.emit("finish");
  finished.emit("close");
  assert.equal(signals[1]!.aborted, false);
  assert.equal(finished.listenerCount("close"), 0);

  await assert.rejects(
    offer(Object.assign(new EventEmitter(), { destroyed: true })),
    { name: "AbortError" },
  );
});

test("public keyboard and touch routes retain server-owned control types", async () => {
  const calls: DisplayControlRequest[] = [];
  const controller = new DisplayPublicController(
    { admit: async () => undefined } as never,
    {
      execute: async (_id: string, request: DisplayControlRequest) => {
        calls.push(request);
        return { executed: true };
      },
    } as never,
    {} as never,
  );
  await controller.keyboard(
    "session",
    {
      type: "clipboard",
      text: "injected",
      key: "a",
    } as never,
    { headers: {} },
  );
  await controller.touch(
    "session",
    {
      type: "clipboard",
      text: "injected",
      x: 1,
      y: 1,
    } as never,
    { headers: {} },
  );
  assert.deepEqual(
    calls.map((request) => request.type),
    ["keyboard", "touch"],
  );
});
