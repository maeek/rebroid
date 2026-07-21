import assert from "node:assert/strict";
import test from "node:test";
import { DisplayControlService } from "./display-control.service";
import type { AdbService } from "../adb/adb.service";
import type { ScrcpyService } from "../scrcpy/scrcpy.service";
import type { DisplaySessionService } from "./display-session.service";
import type { DisplayControlRequest } from "./display.types";

const requests: DisplayControlRequest[] = [
  { type: "action", command: "home" },
  { type: "keyboard", eventType: "keydown", key: "a" },
  { type: "touch", action: "tap", x: 10, y: 20 },
  { type: "clipboard", text: "hello" },
];

const service = (handledByStream: boolean, reconnecting = false) => {
  const sessions = {
    get: () => ({ udid: "127.0.0.1:5555" }),
    assertCapability: () => undefined,
    touch: () => undefined,
  } as unknown as DisplaySessionService;
  const adb = {
    viewerAction: async () => ({}),
    keyboardEvent: async () => ({}),
    touchEvent: async () => ({}),
    setClipboard: async () => ({}),
  } as unknown as AdbService;
  const scrcpy = {
    sendViewerAction: () => handledByStream,
    sendKeyboardEvent: () => handledByStream,
    sendTouchEvent: () => handledByStream,
    sendClipboard: () => handledByStream,
    shouldWaitForStreamControl: () => reconnecting,
  } as unknown as ScrcpyService;
  return new DisplayControlService(sessions, adb, scrcpy);
};

test("all control kinds share stream and ADB fallback semantics", async () => {
  for (const request of requests) {
    assert.equal(
      (await service(true).execute("session", request)).transport,
      "stream-control",
    );
    assert.equal(
      (await service(false).execute("session", request)).transport,
      "adb",
    );
  }
});

test("controls expose stable invalid and reconnecting errors", async () => {
  await assert.rejects(
    service(true).execute("session", { type: "action", command: "invalid" }),
    (error: unknown) =>
      JSON.stringify(
        (error as { getResponse: () => unknown }).getResponse(),
      ).includes("invalid_control"),
  );
  await assert.rejects(
    service(false, true).execute("session", requests[0]),
    (error: unknown) =>
      JSON.stringify(
        (error as { getResponse: () => unknown }).getResponse(),
      ).includes("control_reconnecting"),
  );
});
