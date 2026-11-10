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

const service = (
  handledByStream: boolean,
  reconnecting = false,
  surfaceKind = "main",
) => {
  const sessions = {
    get: () => ({ id: "session", udid: "127.0.0.1:5555", surfaceKind }),
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

test("virtual surfaces use stream control and reject device-wide ADB fallback", async () => {
  for (const request of requests) {
    assert.equal(
      (await service(true, false, "virtual").execute("session", request))
        .transport,
      "stream-control",
    );
    await assert.rejects(
      service(false, false, "virtual").execute("session", request),
      {
        message: "Live controls are reconnecting. Try again in a moment.",
      },
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

test("unknown control types cannot fall through to clipboard execution", async () => {
  await assert.rejects(
    service(true).execute("session", {
      type: "unknown",
      text: "secret",
    } as unknown as DisplayControlRequest),
  );
});

test("does not acknowledge a live pointer phase as executed by ADB", async () => {
  await assert.rejects(
    service(false).execute("session", {
      type: "touch",
      action: "pointer",
      eventType: "up",
      x: 12,
      y: 15,
    }),
    (error: unknown) =>
      JSON.stringify(
        (error as { getResponse: () => unknown }).getResponse(),
      ).includes("control_reconnecting"),
  );
});
