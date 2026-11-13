import assert from "node:assert/strict";
import test from "node:test";
import { DisplayControlService } from "./display-control.service";
import type { AdbService } from "../adb/adb.service";
import type { ScrcpyService } from "../scrcpy/scrcpy.service";
import { DisplaySessionService } from "./display-session.service";
import type { DisplayControlRequest } from "./display.types";
import { setImmediate } from "node:timers/promises";
import { DisplayController } from "./display.controller";
import { ScrcpyControlDispatchError } from "../scrcpy/scrcpy-control-dispatch-error";

const requests: DisplayControlRequest[] = [
  { type: "action", command: "home" },
  { type: "keyboard", eventType: "keydown", key: "a" },
  { type: "touch", action: "tap", x: 10, y: 20 },
  { type: "clipboard", text: "hello" },
];

const service = (
  handledByStream: boolean | Promise<boolean>,
  reconnecting = false,
  surfaceKind = "main",
  activeControl = true,
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
    hasActiveControl: () => activeControl,
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

test("a video-only display grant denies actions, keyboard, touch and clipboard", async () => {
  const sessions = new DisplaySessionService(
    {
      sessionTtlSeconds: 900,
      sessionMaxLifetimeSeconds: 3600,
      sessionMaxActive: 8,
    } as never,
    {} as never,
  );
  const grant = sessions.create({
    udid: "127.0.0.1:5555",
    capabilities: ["video"],
  });
  // Empty adapters make a forbidden dispatch fail differently from the expected capability error.
  const controls = new DisplayControlService(
    sessions,
    {} as never,
    {} as never,
  );
  for (const request of requests) {
    const capability = request.type === "clipboard" ? "clipboard" : "control";
    await assert.rejects(controls.execute(grant.id, request), {
      message: `Display session does not allow ${capability}.`,
    });
  }
});

test("authenticated Home action returns the same acknowledgment shape for either transport", async () => {
  for (const [stream, transport] of [
    [true, "stream-control"],
    [false, "adb"],
  ] as const) {
    const controller = new DisplayController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      service(stream),
      {} as never,
    );
    assert.deepEqual(await controller.action("session", { command: "home" }), {
      ok: true,
      command: "home",
      executed: true,
      transport,
    });
  }
});

test("authenticated Home keeps pre-dispatch rejection and uncertain outcomes distinct", async () => {
  for (const code of [
    "control_not_dispatched",
    "control_outcome_unknown",
  ] as const) {
    const dispatch = Promise.reject(new ScrcpyControlDispatchError(code, code));
    await assert.rejects(
      service(dispatch).executeAction("session", "home"),
      (error: unknown) =>
        (error as { getResponse: () => { code: string } }).getResponse()
          .code === code,
    );
  }
});

test("control waits for stream dispatch and preserves an unknown outcome", async () => {
  let rejectDispatch!: (error: Error) => void;
  const dispatch = new Promise<boolean>((_resolve, reject) => {
    rejectDispatch = reject;
  });
  void dispatch.catch(() => undefined);
  let settled = false;
  const result = service(dispatch).execute("session", requests[0]);
  void result
    .finally(() => {
      settled = true;
    })
    .catch(() => undefined);
  await setImmediate();
  assert.equal(settled, false);

  rejectDispatch(new Error("socket write interrupted"));
  await assert.rejects(result, /could not be executed/);
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

test("Home uses ADB during main capture recovery before any stream dispatch", async () => {
  const control = service(false, true, "main", false);
  assert.deepEqual(await control.executeAction("session", "home"), {
    ok: true,
    command: "home",
    executed: true,
    transport: "adb",
  });
  await assert.rejects(
    service(false, true, "virtual", false).executeAction("session", "home"),
    {
      message: "Live controls are reconnecting. Try again in a moment.",
    },
  );
});
