import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { Logger } from "@nestjs/common";
import type { SidecarConfigService } from "../shared/sidecar-config.service";
import { AdbCommandRunner } from "./adb-command-runner";
import { AdbService } from "./adb.service";

test("package discovery preserves every argument through adb's remote shell", async (t) => {
  const runner = new AdbCommandRunner({} as SidecarConfigService);
  t.mock.method(runner, "text", async (args: string[]) => {
    assert.deepEqual(args.slice(0, 3), ["-s", "device", "shell"]);
    return {
      stdout: execFileSync("/bin/sh", ["-c", args.slice(3).join(" ")], {
        encoding: "utf8",
      }),
      stderr: "",
      exitCode: 0,
    };
  });
  const adb = new AdbService(runner);
  for (const command of [
    "pm list packages -3",
    "cmd package list packages -3",
  ]) {
    const name = command.split(" ")[0];
    const script = `${name}() { printf '%s\\n' "$@"; }; ${command}`;
    assert.deepEqual(
      (await adb.shellCommand("device", script)).stdout.trim().split("\n"),
      command.split(" ").slice(1),
    );
  }
});

const unmappedTextError = new Error(
  "adb command failed with exit code 255: java.lang.NullPointerException: Attempt to get length of null array\n" +
    "at com.android.server.input.InputShellCommand.sendText(InputShellCommand.java:393)",
);

test("recovers unmappable text once and requires the focused-field acknowledgement", async (t) => {
  const text = "Biedronka Połczyńska Warsaw";
  for (const accepted of [true, false]) {
    const runner = new AdbCommandRunner({} as SidecarConfigService);
    const calls: string[][] = [];
    t.mock.method(runner, "text", async (args: string[]) => {
      calls.push(args);
      if (args[3] === "input") throw unmappedTextError;
      return {
        stdout: accepted ? "REBROID_TEXT_INSERTED\n" : "FAILURES!!!\n",
        stderr: "",
        exitCode: 0,
      };
    });
    const result = new AdbService(runner).inputText("device", text);
    if (accepted) await result;
    else await assert.rejects(result, /could not confirm text entry/);
    assert.equal(calls.length, 5);
    const jar = calls[1][4];
    assert.match(jar, /^\/data\/local\/tmp\/rebroid-input-[\da-f-]+\.jar$/);
    assert.deepEqual(calls[2].slice(3), ["chmod", "444", jar]);
    assert.deepEqual(calls[3].slice(3, -1), [
      "uiautomator",
      "runtest",
      jar,
      "/system/framework/android.test.base.jar",
      "-c",
      "io.rebroid.input.FocusedTextInput#testInsert",
      "-e",
      "text",
    ]);
    assert.equal(
      Buffer.from(calls[3].at(-1)!, "base64").toString("utf8"),
      text,
    );
    assert.deepEqual(calls[4], ["-s", "device", "shell", "rm", "-f", jar]);
  }
});

test("an accepted or ambiguous input dispatch is never replayed", async (t) => {
  const runner = new AdbCommandRunner({} as SidecarConfigService);
  const call = t.mock.method(runner, "text", async () => ({
    stdout: "",
    stderr: "",
    exitCode: 0,
  }));
  const adb = new AdbService(runner);
  await adb.inputText("device", "Warsaw");
  call.mock.mockImplementationOnce(async () => {
    throw new Error("ADB timed out");
  });
  await assert.rejects(adb.inputText("device", "Połczyńska"), /timed out/);
  assert.equal(call.mock.callCount(), 2);
});

test("viewer reuses a healthy ADB transport and records only the state check", async (t) => {
  const runner = new AdbCommandRunner({} as SidecarConfigService);
  const state = { stdout: "device\n", stderr: "", exitCode: 0 };
  const text = t.mock.method(runner, "text", async () => state);
  const log = t.mock.method(Logger.prototype, "log", () => undefined);

  assert.equal(
    await new AdbService(runner).ensureViewerConnected("target:5555"),
    state,
  );
  assert.deepEqual(
    text.mock.calls.map(({ arguments: [args] }) => args),
    [["-s", "target:5555", "get-state"]],
  );
  const [event] = log.mock.calls[0].arguments;
  assert.equal(event.event, "viewer_adb_connection");
  assert.equal(event.outcome, "reused");
  assert.ok(event.initialGetStateMs >= 0);
  assert.equal(event.connectMs, null);
  assert.equal(event.verificationGetStateMs, null);
  assert.ok(event.elapsedMs >= event.initialGetStateMs);
});

test("viewer reconnects and verifies ADB when the initial state check fails", async (t) => {
  const runner = new AdbCommandRunner({} as SidecarConfigService);
  const state = { stdout: "device", stderr: "", exitCode: 0 };
  const text = t.mock.method(runner, "text", async () => state);
  text.mock.mockImplementationOnce(async () => {
    throw new Error("device not found");
  });
  const log = t.mock.method(Logger.prototype, "log", () => undefined);

  assert.equal(
    await new AdbService(runner).ensureViewerConnected("target:5555"),
    state,
  );
  assert.deepEqual(
    text.mock.calls.map(({ arguments: [args] }) => args),
    [
      ["-s", "target:5555", "get-state"],
      ["connect", "target:5555"],
      ["-s", "target:5555", "get-state"],
    ],
  );
  const [event] = log.mock.calls[0].arguments;
  assert.equal(event.event, "viewer_adb_connection");
  assert.equal(event.outcome, "reconnected");
  assert.ok(event.initialGetStateMs >= 0);
  assert.ok(event.connectMs >= 0);
  assert.ok(event.verificationGetStateMs >= 0);
});

test("viewer rejects an ADB transport that remains offline after reconnect", async (t) => {
  const runner = new AdbCommandRunner({} as SidecarConfigService);
  const text = t.mock.method(runner, "text", async () => ({
    stdout: "offline",
    stderr: "",
    exitCode: 0,
  }));
  const log = t.mock.method(Logger.prototype, "log", () => undefined);

  await assert.rejects(
    new AdbService(runner).ensureViewerConnected("target:5555"),
    /ADB transport target:5555 is offline/,
  );
  assert.deepEqual(text.mock.calls[1].arguments[0], ["connect", "target:5555"]);
  assert.equal(log.mock.calls[0].arguments[0].outcome, "failed");
});

test("key commands reject shell syntax before starting ADB", async (t) => {
  const calls: string[][] = [];
  const runner = new AdbCommandRunner({} as SidecarConfigService);
  t.mock.method(runner, "text", async (args: string[]) => {
    calls.push(args);
    return { stdout: "", stderr: "", exitCode: 0 };
  });
  const adb = new AdbService(runner);
  await assert.rejects(adb.keyEvent("device", "ENTER; id"), {
    message: "Invalid Android key code.",
  });
  assert.deepEqual(calls, []);
  await adb.keyEvent("device", " keycode_enter ");
  assert.deepEqual(calls, [
    ["-s", "device", "shell", "input", "keyevent", "KEYCODE_ENTER"],
  ]);
});

test("file paths are literal operands in Android's remote shell", async (t) => {
  const calls: string[][] = [];
  const runner = new AdbCommandRunner({} as SidecarConfigService);
  t.mock.method(runner, "text", async (args: string[]) => {
    calls.push(args.slice(3));
    return { stdout: "yes\n", stderr: "", exitCode: 0 };
  });
  const adb = new AdbService(runner);
  const path = "/sdcard/It's a file; $HOME";
  await adb.deleteFile("device", path);
  assert.equal(await adb.fileExists("device", path), true);
  await adb.listFiles("device", path);
  const quoted = "'/sdcard/It'\\''s a file; $HOME'";
  assert.deepEqual(calls, [
    ["rm", "-f", "--", quoted],
    [`[ -e ${quoted} ] && echo yes || echo no`],
    ["ls", "-1A", "--", quoted],
  ]);
});

test("pulls binary file contents through a checked, quoted remote command", async (t) => {
  const runner = new AdbCommandRunner({} as SidecarConfigService);
  const path = "/sdcard/It's a file; $HOME";
  const buffer = t.mock.method(runner, "buffer", async () => Buffer.alloc(0));
  const adb = new AdbService(runner);
  assert.deepEqual(await adb.pullFileContent("device", path), {
    path,
    contentBase64: "",
    sizeBytes: 0,
  });
  assert.deepEqual(buffer.mock.calls[0].arguments, [
    [
      "-s",
      "device",
      "shell",
      "-T",
      "cat",
      "--",
      "'/sdcard/It'\\''s a file; $HOME'",
    ],
    15_000,
  ]);
});

test("tries the compressed dump after a truncated Android hierarchy", async (t) => {
  const runner = new AdbCommandRunner({} as SidecarConfigService);
  const dumps = [
    '<hierarchy><node text="Żappka" bounds="[0,0][20,20]"></hierarchy>',
    '<?xml version="1.0"?><hierarchy><node text="Żappka" bounds="[0,0][20,20]"/></hierarchy>',
  ];
  t.mock.method(runner, "text", async (args: string[]) => ({
    stdout: args[3] === "cat" ? (dumps.shift() ?? "") : "",
    stderr: "",
    exitCode: 0,
  }));
  const result = await new AdbService(runner).dumpUi("device");
  assert.equal(result.status, "available");
  assert.equal(result.attempts.length, 2);
  assert.equal(result.diagnostics?.compressed, true);
  assert.match(result.attempts[0].stderr, /incomplete UI hierarchy/);
});
