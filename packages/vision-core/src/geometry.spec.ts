import assert from "node:assert/strict";
import test from "node:test";
import { normalizedPointToPixels, pixelBoxToNormalized } from "./geometry";

test("normalizedPointToPixels clamps normalized coordinates", () => {
  assert.deepEqual(
    normalizedPointToPixels({ x: 2, y: -1 }, { width: 100, height: 200 }),
    { x: 99, y: 0 },
  );
});

test("pixelBoxToNormalized converts original image bounds", () => {
  assert.deepEqual(
    pixelBoxToNormalized(
      { left: 25, top: 50, width: 50, height: 100 },
      { width: 100, height: 200 },
    ),
    { left: 0.25, top: 0.25, width: 0.5, height: 0.5 },
  );
});
