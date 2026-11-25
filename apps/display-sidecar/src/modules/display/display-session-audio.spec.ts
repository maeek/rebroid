import assert from "node:assert/strict";
import test from "node:test";
import { DisplayController } from "./display.controller";
import type { CreateDisplaySessionDto } from "./display.dto";

test("external session audio requires Android 12 or newer", async () => {
  const request = { udid: "attachment", capabilities: ["video", "audio"] };
  for (const [external, sdk, canCapture] of [
    [true, "30", false],
    [true, "31", true],
    [true, "unknown", false],
    [false, "30", true],
  ] as const) {
    let probed = false;
    const controller = new DisplayController(
      { create: (body: CreateDisplaySessionDto) => body } as never,
      {
        ensureViewerConnected: async () => undefined,
        shell: async (id: string, args: string[]) => {
          assert.equal(id, request.udid);
          assert.deepEqual(args, ["getprop", "ro.build.version.sdk"]);
          probed = true;
          return { stdout: sdk };
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      { isExternalAdbEnabled: () => external } as never,
    );
    const { session } = await controller.createSession(request);
    assert.equal(session.capabilities.includes("audio"), canCapture);
    assert.equal(probed, external);
  }
});
