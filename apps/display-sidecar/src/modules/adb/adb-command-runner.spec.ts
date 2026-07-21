import assert from "node:assert/strict";
import test from "node:test";
import { AdbCommandRunner } from "./adb-command-runner";
import type { SidecarConfigService } from "../shared/sidecar-config.service";

const runner = (textLimit = 1024, binaryLimit = 1024) =>
  new AdbCommandRunner({
    adbPath: process.execPath,
    adbTextOutputMaxBytes: textLimit,
    adbBinaryOutputMaxBytes: binaryLimit,
  } as SidecarConfigService);

test("ADB command runner captures bounded output and exit failures", async () => {
  const result = await runner(8).text(
    ["-e", "process.stdout.write('abcdefghijkl')"],
    1_000,
  );
  assert.match(result.stdout, /^abcdefgh/);
  assert.match(result.stdout, /truncated 4 bytes/);

  await assert.rejects(
    runner().text(
      ["-e", "process.stderr.write('safe failure'); process.exit(2)"],
      1_000,
    ),
    /failed with exit code 2: safe failure/,
  );
});

test("ADB command runner bounds binary output", async () => {
  await assert.rejects(
    runner(1024, 4).buffer(["-e", "process.stdout.write('12345')"], 1_000),
    /produced more than 4 bytes/,
  );
});

test("ADB command runner handles timeout and cancellation", async () => {
  await assert.rejects(
    runner().text(["-e", "setInterval(() => {}, 1000)"], 20),
    /timed out after 20ms/,
  );

  const controller = new AbortController();
  const pending = runner().text(["-e", "setInterval(() => {}, 1000)"], 1_000, {
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(pending, /was cancelled/);
});
