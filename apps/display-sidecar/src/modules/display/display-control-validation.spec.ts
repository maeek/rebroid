import assert from "node:assert/strict";
import test from "node:test";
import { validateDisplayControl } from "./display-control-validation";

test("controls reject malformed types, non-finite coordinates, and oversized clipboard content", () => {
  for (const input of [
    { type: "touch", x: "1; reboot" },
    { type: "touch", x: Infinity },
    { type: "keyboard", ctrlKey: "false" },
    { type: "clipboard", text: "a".repeat(65537) },
    { type: "unknown" },
  ]) {
    assert.throws(() => validateDisplayControl(input));
  }
});
test("controls strip unexpected fields before runtime dispatch", () => {
  assert.deepEqual(
    validateDisplayControl({
      type: "keyboard",
      key: "a",
      text: "clipboard",
      command: "reboot",
    }),
    { type: "keyboard", key: "a" },
  );
});
