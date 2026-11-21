import assert from "node:assert/strict";
import { once } from "node:events";
import { Writable } from "node:stream";
import test from "node:test";
import {
  dataChannelReplaceKey,
  WebrtcCommandQueueFullError,
  WebrtcCommandRelay,
} from "./display-webrtc-command-relay";

function pausedSocket() {
  let complete: (() => void) | undefined;
  const received: unknown[] = [];
  const socket = new Writable({
    highWaterMark: 1,
    write(chunk: Buffer, _encoding, done) {
      received.push(JSON.parse(chunk.toString()));
      complete = done;
    },
  });
  return {
    socket,
    received,
    async drain() {
      assert.ok(complete);
      const drained = once(socket, "drain");
      complete();
      await drained;
    },
  };
}

test("IPC backpressure preserves reliable commands and coalesces telemetry", async (t) => {
  const { socket, received, drain } = pausedSocket();
  t.after(() => {
    socket.destroy();
  });
  const relay = new WebrtcCommandRelay(socket);
  const first = { type: "offer", sdp: "fixture" };
  const reply = { type: "heartbeat", id: "correlated" };
  const status = { type: "webrtc-codec-changed" };
  const telemetry = { type: "heartbeat", sequence: 2 };
  relay.send(first);
  for (const payload of [
    { ...telemetry, sequence: 1 },
    reply,
    status,
    telemetry,
  ]) {
    relay.send(payload, dataChannelReplaceKey(payload));
  }
  assert.deepEqual(received, [first]);
  for (const next of [reply, status, telemetry]) {
    await drain();
    assert.deepEqual(received.at(-1), next);
  }
  await drain();
  assert.deepEqual(received, [first, reply, status, telemetry]);
});

test("a blocked reliable backlog closes its socket at the count or byte limit", async (t) => {
  for (const payload of ["reply", "x".repeat(600_000)]) {
    await t.test(`${payload.length}-byte replies`, async () => {
      const { socket, received } = pausedSocket();
      const relay = new WebrtcCommandRelay(socket);
      const failed = once(socket, "error");
      relay.send({ type: "offer" });
      for (let i = 0; i <= 64; i++) relay.send({ id: i, payload });
      const [error] = await failed;
      assert.ok(error instanceof WebrtcCommandQueueFullError);
      assert.deepEqual(received, [{ type: "offer" }]);
      assert.equal(socket.destroyed, true);
    });
  }
});
