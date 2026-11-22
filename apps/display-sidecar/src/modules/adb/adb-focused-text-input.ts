import { BadRequestException, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { AdbCommandRunner } from "./adb-command-runner";
import { inputTextCommand } from "./adb-input";

const helper = join(
  __dirname,
  "../../../dist/android-input/focused-text-input.jar",
);
const logger = new Logger("AdbFocusedTextInput");

export async function inputAndroidText(
  runner: AdbCommandRunner,
  udid: string,
  text: string,
  signal?: AbortSignal,
) {
  const device = ["-s", udid];
  const shell = [...device, "shell"];
  try {
    return await runner.text([...shell, ...inputTextCommand(text)], 10_000, {
      signal,
    });
  } catch (error) {
    // sendText maps the whole string before dispatch. Only this failure is safe to retry.
    if (
      !(error instanceof Error) ||
      !error.message.includes(
        "NullPointerException: Attempt to get length of null array",
      ) ||
      !error.message.includes(
        "at com.android.server.input.InputShellCommand.sendText(",
      )
    ) {
      throw error;
    }
  }
  signal?.throwIfAborted();
  const jar = `/data/local/tmp/rebroid-input-${randomUUID()}.jar`;
  try {
    await runner.text([...device, "push", helper, jar], 5_000, { signal });
    await runner.text([...shell, "chmod", "444", jar], 5_000, { signal });
    const result = await runner.text(
      [
        ...shell,
        "uiautomator",
        "runtest",
        jar,
        "/system/framework/android.test.base.jar",
        "-c",
        "io.rebroid.input.FocusedTextInput#testInsert",
        "-e",
        "text",
        Buffer.from(text).toString("base64"),
      ],
      10_000,
      { signal, rejectOnNonZero: false },
    );
    // uiautomator can exit zero even after an assertion failure.
    if (
      result.exitCode !== 0 ||
      !result.stdout.split(/\r?\n/).includes("REBROID_TEXT_INSERTED")
    ) {
      throw new BadRequestException(
        "Android could not confirm text entry in the focused editable field.",
      );
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  } finally {
    await runner
      .text([...shell, "rm", "-f", jar], 3_000)
      .catch(() =>
        logger.warn("Could not remove temporary Android text input helper."),
      );
  }
}
