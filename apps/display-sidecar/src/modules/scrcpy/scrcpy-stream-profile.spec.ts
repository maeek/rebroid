import assert from "node:assert/strict";
import test from "node:test";
import { ScrcpyBootstrapSink } from "./scrcpy-bootstrap-sink";
import { ScrcpyService } from "./scrcpy.service";

const profile = {
  udid: "fixture",
  codec: "h264" as const,
  maxSize: 0,
  maxFps: 60,
  bitrate: 16_000_000,
  audio: false,
};

test("profile conflict preserves both active captures and settings can change after detach", (t) => {
  const service = new ScrcpyService(
    {} as never,
    { scrcpyVersion: "5.0.1" } as never,
  );
  service["collectCompatibilityProbe"] = async () => null;
  service["runSource"] = () => new Promise<void>(() => undefined);
  t.after(() => service.onModuleDestroy());
  const attach = (sessionId: string, bitrate = profile.bitrate) =>
    service.attachStream(
      { ...profile, sessionId, bitrate, sink: new ScrcpyBootstrapSink() },
      "bootstrap",
    );

  const first = attach("first");
  const otherApp = attach("other");
  assert.notEqual(first.sourceAttemptId, otherApp.sourceAttemptId);
  assert.throws(
    () => attach("first", 2_000_000),
    /already streaming with different settings/,
  );
  const sameProfile = attach("first");
  assert.equal(sameProfile.sourceAttemptId, first.sourceAttemptId);
  assert.equal(attach("other").sourceAttemptId, otherApp.sourceAttemptId);
  first.detach();
  sameProfile.detach();
  assert.notEqual(
    attach("first", 2_000_000).sourceAttemptId,
    first.sourceAttemptId,
  );
});
