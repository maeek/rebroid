import assert from "node:assert/strict";
import test from "node:test";
import type { TouchControlPayload } from "../shared/display-control.types";
import { ScrcpyControlCodec } from "./scrcpy-control-codec";
import { ScrcpyLivePointers } from "./scrcpy-live-pointers";

test("scroll uses the scrcpy position and signed fixed-point axis layout", () => {
  const codec = new ScrcpyControlCodec();
  const payload = codec.scrollEventPayload({
    x: 100,
    y: 20,
    videoWidth: 80,
    videoHeight: 120,
    horizontal: 0.5,
    vertical: -16,
  });
  assert.equal(
    payload.toString("hex"),
    "030000004f00000014005000780400800000000000",
  );
});

test("live contacts belong to their connection and release at the current frame size", async () => {
  const codec = new ScrcpyControlCodec();
  const written: Array<{
    phase: number;
    id: bigint;
    width: number;
    release: boolean;
  }> = [];
  let size = { width: 100, height: 200 };
  const pointers = new ScrcpyLivePointers(
    (event, release) => {
      const payload = codec.touchEventPayloads(event)?.[0];
      assert.ok(payload);
      written.push({
        phase: payload[1]!,
        id: payload.readBigInt64BE(2),
        width: payload.readUInt16BE(18),
        release,
      });
      return true;
    },
    () => size,
  );
  const first = new AbortController();
  const replacement = new AbortController();
  const send = (
    pointerId: number,
    eventType: TouchControlPayload["eventType"],
    connection = first.signal,
  ) =>
    pointers.dispatch(
      {
        action: "pointer",
        pointerId,
        eventType,
        videoWidth: 100,
        videoHeight: 200,
        x: 25,
        y: 50,
      },
      connection,
    );
  assert.equal(await send(2, "down"), true);
  assert.equal(await send(5, "down"), true);
  assert.equal(await send(8, "down"), false);
  assert.equal(await send(2, "move", replacement.signal), false);
  size = { width: 200, height: 100 };
  first.abort();
  assert.equal(await send(5, "move"), false);
  assert.equal(await send(2, "up", replacement.signal), false);
  assert.equal(await send(8, "down", replacement.signal), true);
  assert.deepEqual(written, [
    { phase: 0, id: 2n, width: 100, release: false },
    { phase: 0, id: 5n, width: 100, release: false },
    { phase: 1, id: 2n, width: 200, release: true },
    { phase: 1, id: 5n, width: 200, release: true },
    { phase: 0, id: 8n, width: 100, release: false },
  ]);
});
