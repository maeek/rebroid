import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCompatibilityProbe,
  planScrcpyInitialRetry,
  planScrcpyRestart,
  planScrcpyRestartBackoff,
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
    planScrcpyInitialRetry(streamOptions, "ADB connection failed", probe),
    null,
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
  const retry = planScrcpyInitialRetry(
    streamOptions,
    "invalid audio stream: scrcpy stream configuration failed on the device",
    null,
  );
  assert.ok(retry);
  assert.deepEqual(retry, {
    options: {
      ...streamOptions,
      audio: false,
      compatibilityMode: "audio-disabled",
    },
    disablesAudio: true,
    description: "video only",
    reconnectMessage: "Retrying live display without Android audio capture...",
  });

  const withoutControl = planScrcpyInitialRetry(
    retry.options,
    "InputManagerGlobal failed",
    null,
  );
  assert.ok(withoutControl);
  assert.equal(withoutControl.options.audio, false);
  assert.equal(withoutControl.options.control, false);
  assert.equal(withoutControl.disablesAudio, false);
  assert.equal(
    withoutControl.options.compatibilityMode,
    "stream-control-disabled",
  );

  const silentOptions = { ...streamOptions, audio: false };
  const unchanged = planScrcpyRestart(
    silentOptions,
    { reason: "socket closed", durationMs: 1_000, bytesForwarded: 1 },
    false,
  );
  assert.equal(unchanged.options, silentOptions);
  assert.equal(unchanged.disablesAudio, false);
});

test("unrelated startup failures do not disable requested audio", () => {
  for (const message of [
    "ADB connection failed",
    "scrcpy video socket closed during startup.",
    "Display source was replaced.",
  ]) {
    assert.equal(planScrcpyInitialRetry(streamOptions, message, null), null);
  }
});

test("a control failure preserves audio when selecting a compatibility retry", () => {
  const retry = planScrcpyInitialRetry(
    streamOptions,
    "InputManagerGlobal failed",
    null,
  );
  assert.deepEqual(retry, {
    options: {
      ...streamOptions,
      control: false,
      compatibilityMode: "stream-control-disabled",
    },
    disablesAudio: false,
    description: "ADB control fallback",
    reconnectMessage: "Retrying live display without scrcpy stream control...",
  });
});

test("virtual surfaces never fall back to default-display ADB controls", () => {
  for (const surface of [
    { displayId: 2 },
    { newDisplay: { width: 1080, height: 1920, dpi: 320 } },
  ]) {
    const options = { ...streamOptions, ...surface };
    assert.equal(
      planScrcpyInitialRetry(options, "InputManagerGlobal failed", null),
      null,
    );
  }
});

test("restart disables audio only after the scrcpy audio configuration marker", () => {
  const completed = {
    reason: "video socket closed",
    durationMs: 1_000,
    bytesForwarded: 1,
  };
  const ordinaryRestart = planScrcpyRestart(streamOptions, completed, false);
  assert.equal(ordinaryRestart.options, streamOptions);
  assert.equal(ordinaryRestart.disablesAudio, false);

  const audioFailure = planScrcpyRestart(
    streamOptions,
    {
      ...completed,
      reason:
        "invalid audio stream: scrcpy stream configuration failed on the device",
    },
    false,
  );
  assert.deepEqual(audioFailure, {
    options: {
      ...streamOptions,
      audio: false,
      compatibilityMode: "audio-disabled",
    },
    disablesAudio: true,
  });
  assert.deepEqual(
    planScrcpyRestart(streamOptions, completed, true),
    audioFailure,
  );
});

test("restart backoff caps rapid retries and resets after a stable stream", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5].map((attempt) => planScrcpyRestartBackoff(attempt)),
    [500, 1_000, 2_000, 4_000, 5_000, 5_000].map((delayMs, index) => ({
      attempt: index + 1,
      delayMs,
    })),
  );
  assert.deepEqual(planScrcpyRestartBackoff(4, 30_000), {
    attempt: 5,
    delayMs: 5_000,
  });
  assert.deepEqual(planScrcpyRestartBackoff(4, 30_001), {
    attempt: 0,
    delayMs: 500,
  });
});
