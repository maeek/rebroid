import assert from "node:assert/strict";
import test from "node:test";
import type { SidecarConfigService } from "../shared/sidecar-config.service";
import { AdbCommandRunner } from "./adb-command-runner";
import { AdbService } from "./adb.service";

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
