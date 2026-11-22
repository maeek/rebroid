import assert from "node:assert/strict";
import test from "node:test";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { AdbCommandRunner } from "./adb-command-runner";
import { AdbService } from "./adb.service";

const serial = process.env.REBROID_INPUT_TEST_SERIAL;
const marker = "rebroid-input-test";

test(
  "inserts exact Unicode text at the cursor on an Android device",
  { skip: !serial },
  async () => {
    assert.ok(serial);
    const adb = new AdbService(
      new AdbCommandRunner(new SidecarConfigService()),
    );
    const focusedText = async () => {
      const dump = await adb.dumpUi(serial);
      assert.equal(dump.status, "available");
      const field = dump.xml?.match(
        /<node\b(?=[^>]*\bfocused="true")(?=[^>]*\bclass="android\.widget\.EditText")[^>]*>/,
      )?.[0];
      return field?.match(/\btext="([^"]*)"/)?.[1];
    };
    assert.equal(
      await focusedText(),
      marker,
      "Focus a test field containing only rebroid-input-test.",
    );
    await adb.keyEvent(serial, "MOVE_HOME");
    const query = "Biedronka Połczyńska Warsaw";
    await adb.inputText(serial, query);
    await adb.inputText(serial, "!");
    assert.equal(await focusedText(), query + "!" + marker);
  },
);
