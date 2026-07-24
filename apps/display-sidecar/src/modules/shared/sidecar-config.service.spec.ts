import assert from "node:assert/strict";
import test from "node:test";
import { parseSidecarEnvironment } from "./sidecar-config.service";

test("display configuration accepts bounded defaults and explicit authentication override", () => {
  const parsed = parseSidecarEnvironment({
    PORT: "8000",
    DISPLAY_SESSION_MAX_ACTIVE: "64",
    DISPLAY_WEBRTC_UDP_PORT_RANGE: "40000-40100",
    DISPLAY_SIDECAR_ALLOW_UNAUTHENTICATED_INTERNAL_API: "true",
    SCRCPY_VIDEO_ENCODER: "c2.android.avc.encoder",
  });
  assert.equal(parsed.PORT, 8000);
  assert.equal(parsed.DISPLAY_SESSION_MAX_ACTIVE, 64);
  assert.equal(
    parsed.DISPLAY_SIDECAR_ALLOW_UNAUTHENTICATED_INTERNAL_API,
    "true",
  );
  assert.equal(parsed.SCRCPY_VIDEO_ENCODER, "c2.android.avc.encoder");
});

test("display configuration rejects invalid capacity and port ranges", () => {
  assert.throws(() =>
    parseSidecarEnvironment({ DISPLAY_SESSION_MAX_ACTIVE: "0" }),
  );
  assert.throws(() =>
    parseSidecarEnvironment({ DISPLAY_WEBRTC_UDP_PORT_RANGE: "50000-40000" }),
  );
  assert.throws(() =>
    parseSidecarEnvironment({ SCRCPY_VIDEO_ENCODER: "encoder; reboot" }),
  );
  assert.equal(
    parseSidecarEnvironment({ SCRCPY_VIDEO_ENCODER: "" }).SCRCPY_VIDEO_ENCODER,
    undefined,
  );
});
