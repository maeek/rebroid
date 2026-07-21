import assert from "node:assert/strict";
import test from "node:test";
import { escapeAdbInputText, keyboardCommand, touchCommand } from "./adb-input";

test("keyboard command construction handles special, text, and ignored events", () => {
  assert.deepEqual(keyboardCommand({ eventType: "keydown", key: "Enter" }), [
    "input",
    "keyevent",
    "KEYCODE_ENTER",
  ]);
  assert.deepEqual(keyboardCommand({ eventType: "keydown", key: "a" }), [
    "input",
    "text",
    "a",
  ]);
  assert.equal(keyboardCommand({ eventType: "keyup", key: "a" }), null);
  assert.equal(
    keyboardCommand({ eventType: "keydown", key: "a", ctrlKey: true }),
    null,
  );
  assert.equal(escapeAdbInputText("50% done"), "50%25%sdone");
});

test("touch command construction scales coordinates and bounds duration", () => {
  assert.deepEqual(
    touchCommand(
      {
        action: "swipe",
        x1: 10,
        y1: 20,
        x2: 30,
        y2: 40,
        videoWidth: 100,
        videoHeight: 100,
        durationMs: 10_000,
      },
      { width: 200, height: 300 },
    ),
    ["input", "swipe", "20", "60", "60", "120", "2000"],
  );
  assert.equal(touchCommand({ action: "pointer" }, null), null);
});
