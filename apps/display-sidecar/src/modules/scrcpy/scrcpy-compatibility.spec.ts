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

test("keeps Android audio diagnostics without treating historical logs as a new failure", () => {
  const probe = parseCompatibilityProbe(
    "== props ==\nro.build.version.sdk=36\nro.product.brand=redroid",
    "AudioRecord: capture failed\nAudioFlinger: input unavailable\nunrelated",
  );
  assert.equal(probe.diagnostics.length, 2);
  assert.equal(
    selectInitialRetryStreamOptions(
      streamOptions,
      "ADB connection failed",
      probe,
    ).audio,
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

test("retries a confirmed audio failure without changing the requested video profile", () => {
  const withoutAudio = selectInitialRetryStreamOptions(
    streamOptions,
    "invalid audio stream: scrcpy stream configuration failed on the device",
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

test("unrelated startup failures do not disable requested audio", () => {
  for (const message of [
    "ADB connection failed",
    "scrcpy video socket closed during startup.",
    "Display source was replaced.",
  ]) {
    const retry = selectInitialRetryStreamOptions(streamOptions, message, null);
    assert.equal(retry.audio, true, message);
    assert.equal(retry.compatibilityMode, undefined, message);
  }
});

test("a control failure preserves audio when selecting a compatibility retry", () => {
  const retry = selectInitialRetryStreamOptions(
    streamOptions,
    "InputManagerGlobal failed",
    null,
  );
  assert.equal(retry.audio, true);
  assert.equal(retry.control, false);
  assert.equal(retry.compatibilityMode, "stream-control-disabled");
});

test("virtual surfaces never fall back to default-display ADB controls", () => {
  for (const surface of [
    { displayId: 2 },
    { newDisplay: { width: 1080, height: 1920, dpi: 320 } },
  ]) {
    const options = { ...streamOptions, ...surface };
    assert.equal(
      selectInitialRetryStreamOptions(
        options,
        "InputManagerGlobal failed",
        null,
      ),
      options,
    );
  }
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
