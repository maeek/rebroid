import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  audioMediaFrame,
  encodeRebroidMediaFrame,
  videoMediaFrame,
} from "./scrcpy-media-frame";

test("encodes the RBD1 frames shared with the Go bridge", () => {
  const fixture = readFileSync(
    join(__dirname, "../../../webrtc-bridge/testdata/rbd1-frames.bin"),
  );
  const frames = [
    videoMediaFrame(
      {
        data: Buffer.from([0, 0, 0, 1, 0x67]),
        timestampUs: 0n,
        config: true,
        keyFrame: false,
      },
      0x01020304,
    ),
    videoMediaFrame(
      {
        data: Buffer.from([0, 0, 0, 1, 0x65]),
        timestampUs: (1n << 63n) + 42n,
        config: false,
        keyFrame: true,
      },
      0x01020305,
      true,
    ),
    audioMediaFrame(
      {
        data: Buffer.from([0xf8, 0xff, 0xfe]),
        timestampUs: 42_000n,
        config: false,
      },
      0xffffffff,
    ),
  ];

  assert.deepEqual(Buffer.concat(frames.map(encodeRebroidMediaFrame)), fixture);
});
