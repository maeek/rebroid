import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeRebroidMediaFrame,
  REBROID_MEDIA_HEADER_BYTES,
  rebroidMediaFlag,
  rebroidMediaKind,
  videoMediaFrame,
} from "./scrcpy-media-frame";

test("encodes an RBD1 video frame with unsigned timestamp and flags", () => {
  const payload = Buffer.from([1, 2, 3]);
  const encoded = encodeRebroidMediaFrame(
    videoMediaFrame(
      {
        data: payload,
        timestampUs: (1n << 63n) + 42n,
        config: false,
        keyFrame: true,
      },
      17,
      true,
    ),
  );

  assert.equal(encoded.subarray(0, 4).toString("ascii"), "RBD1");
  assert.equal(encoded.readUInt8(4), 1);
  assert.equal(encoded.readUInt8(5), rebroidMediaKind.video);
  assert.equal(
    encoded.readUInt16BE(6),
    rebroidMediaFlag.keyFrame | rebroidMediaFlag.discontinuity,
  );
  assert.equal(encoded.readUInt32BE(8), 17);
  assert.equal(encoded.readBigUInt64BE(12), (1n << 63n) + 42n);
  assert.equal(encoded.readUInt32BE(20), payload.byteLength);
  assert.deepEqual(
    [...encoded.subarray(REBROID_MEDIA_HEADER_BYTES)],
    [1, 2, 3],
  );
});
