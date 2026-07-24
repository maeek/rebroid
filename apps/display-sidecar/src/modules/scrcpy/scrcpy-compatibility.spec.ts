import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCompatibilityProbe,
  selectInitialRetryStreamOptions,
  selectRestartStreamOptions,
  shouldRetryWithoutStreamControl,
} from "./scrcpy-compatibility";

test("parses compatibility properties, services, encoders, and diagnostics", () => {
  const probe = parseCompatibilityProbe(
    [
      "== props ==",
      "ro.build.version.release=15",
      "ro.build.version.sdk=35",
      "ro.product.brand=redroid",
      "ro.product.model=virtual",
      "ro.build.id=AP3A",
      "ro.redroid.version=15.0",
      "== services ==",
      "input=missing",
      "settings=found",
      "display=found",
      "SurfaceFlinger=found",
      "== encoders ==",
      "c2.android.avc.encoder",
    ].join("\n"),
    "unrelated\nInputManagerGlobal failed to load",
  );

  assert.equal(probe.androidSdk, 35);
  assert.equal(probe.services.input, "missing");
  assert.deepEqual(probe.encoders, ["c2.android.avc.encoder"]);
  assert.deepEqual(probe.diagnostics, ["InputManagerGlobal failed to load"]);
});

test("retries Android 15 redroid control setup for known service failures", () => {
  const probe = parseCompatibilityProbe(
    "== props ==\nro.build.version.sdk=35\nro.product.brand=redroid",
    "Can't find service: input",
  );
  assert.equal(
    shouldRetryWithoutStreamControl("control socket failed", probe),
    true,
  );
});

test("does not downgrade older non-redroid devices", () => {
  const probe = parseCompatibilityProbe(
    "== props ==\nro.build.version.sdk=34\nro.product.brand=google",
    "Can't find service: input",
  );
  assert.equal(shouldRetryWithoutStreamControl("control failed", probe), false);
});

const streamOptions = {
  sessionId: "session-1",
  udid: "device-1",
  sink: {
    isOpen: () => true,
    onClose: () => undefined,
    sendStatus: () => undefined,
    writeVideo: () => undefined,
    writeAudio: () => undefined,
    snapshot: () => ({
      sourceVideoFrames: 0,
      video: {
        queuedFrames: 0,
        queuedBytes: 0,
        queueDepthMs: 0,
        droppedFrames: 0,
        awaitingKeyFrame: true,
      },
      audio: {
        queuedFrames: 0,
        queuedBytes: 0,
        queueDepthMs: 0,
        droppedFrames: 0,
        awaitingKeyFrame: false,
      },
    }),
    close: () => undefined,
  },
  codec: "h264" as const,
  maxSize: 1080,
  maxFps: 60,
  bitrate: 8_000_000,
  audio: true,
  control: true,
};

test("retries audio and control without changing the requested video profile", () => {
  const withoutAudio = selectInitialRetryStreamOptions(
    streamOptions,
    "audio failed",
    null,
  );
  assert.equal(withoutAudio.audio, false);
  assert.equal(withoutAudio.compatibilityMode, "audio-disabled");

  const withoutControl = selectInitialRetryStreamOptions(
    { ...withoutAudio, control: true },
    "InputManagerGlobal failed",
    null,
  );
  assert.equal(withoutControl.control, false);
  assert.equal(withoutControl.compatibilityMode, "stream-control-disabled");

  const unchanged = selectRestartStreamOptions(
    { ...streamOptions, audio: false },
    { reason: "socket closed", durationMs: 1_000, bytesForwarded: 1 },
    false,
  );
  assert.equal(unchanged.compatibilityMode, undefined);
  assert.equal(unchanged.maxSize, 1080);
  assert.equal(unchanged.maxFps, 60);
  assert.equal(unchanged.bitrate, 8_000_000);
});

test("restart disables audio only after the scrcpy audio configuration marker", () => {
  const ordinaryRestart = selectRestartStreamOptions(
    streamOptions,
    { reason: "video socket closed", durationMs: 1_000, bytesForwarded: 1 },
    false,
  );
  assert.equal(ordinaryRestart.audio, true);

  const audioFailure = selectRestartStreamOptions(
    streamOptions,
    {
      reason:
        "invalid audio stream: scrcpy stream configuration failed on the device",
      durationMs: 1_000,
      bytesForwarded: 1,
    },
    false,
  );
  assert.equal(audioFailure.audio, false);
  assert.equal(audioFailure.maxFps, 60);
});
