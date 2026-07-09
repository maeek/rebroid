import assert from "node:assert/strict";
import test from "node:test";
import { parseSpsDimensions } from "./h264-mp4-recorder";

test("parses a baseline H264 SPS dimension fixture", () => {
  const sps = Buffer.from(
    "6742c01fda014016ec0440000003004000000c83c60c658",
    "hex",
  );
  assert.deepEqual(parseSpsDimensions(sps), { width: 1280, height: 720 });
});

test("returns null for a truncated SPS", () => {
  assert.equal(parseSpsDimensions(Buffer.from([0x67])), null);
});
