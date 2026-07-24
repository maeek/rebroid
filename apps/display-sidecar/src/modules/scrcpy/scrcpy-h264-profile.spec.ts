import assert from "node:assert/strict";
import test from "node:test";
import { supportsH264PixelRate } from "./scrcpy-h264-profile";

test("requires H.264 level 5.1 for native 1080x2340 at 60 fps", () => {
  assert.equal(supportsH264PixelRate("42c032", 1080, 2340, 60), false);
  assert.equal(supportsH264PixelRate("42c033", 1080, 2340, 60), true);
});

test("rejects malformed and unknown H.264 levels", () => {
  assert.equal(supportsH264PixelRate("invalid", 1080, 2340, 60), false);
  assert.equal(supportsH264PixelRate("42c0ff", 1080, 2340, 60), false);
});
