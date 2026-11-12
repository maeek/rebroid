import assert from "node:assert/strict";
import test from "node:test";
import type { SidecarConfigService } from "../shared/sidecar-config.service";
import { AdbCommandRunner } from "./adb-command-runner";
import { AdbService } from "./adb.service";

test("notification fallback shares the first command's deadline", async (t) => {
  const runner = new AdbCommandRunner({} as SidecarConfigService);
  const text = t.mock.method(runner, "text", async (args: string[]) => {
    if (args.includes("--noredact")) throw new Error("Unsupported option");
    return { stdout: "notifications", stderr: "", exitCode: 0 };
  });

  assert.equal(
    (await new AdbService(runner).notifications("device")).stdout,
    "notifications",
  );
  assert.deepEqual(
    text.mock.calls.map(({ arguments: [args] }) => args),
    [
      ["-s", "device", "shell", "dumpsys", "notification", "--noredact"],
      ["-s", "device", "shell", "dumpsys", "notification"],
    ],
  );
  const first = text.mock.calls[0].arguments[2]?.signal;
  assert.ok(first);
  assert.equal(text.mock.calls[1].arguments[2]?.signal, first);
});

test("does not launch another notification dump after cancellation", async (t) => {
  const runner = new AdbCommandRunner({} as SidecarConfigService);
  const abort = new AbortController();
  const text = t.mock.method(runner, "text", async () => {
    abort.abort();
    throw new Error("ADB stopped");
  });

  await assert.rejects(
    new AdbService(runner).notifications("device", abort.signal),
    { name: "AbortError" },
  );
  assert.equal(text.mock.callCount(), 1);
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
