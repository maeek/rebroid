import assert from "node:assert/strict";
import test from "node:test";
import { ScrcpyStreamSessionRegistry } from "./scrcpy-stream-session-registry";
import type { ScrcpyMediaSink, ScrcpyStreamOptions } from "./scrcpy.types";

function fakeSink() {
  const closes: Array<{ code?: number; reason?: string }> = [];
  const sink: ScrcpyMediaSink = {
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
    close: (code?: number, reason?: string) => {
      closes.push({ code, reason });
    },
  };
  return { sink, closes };
}

function streamOptions(
  sink: ScrcpyMediaSink,
  overrides: Partial<ScrcpyStreamOptions> = {},
): ScrcpyStreamOptions {
  return {
    sessionId: "session-1",
    udid: "device-1",
    sink,
    codec: "h264",
    maxSize: 1080,
    maxFps: 30,
    bitrate: 3_000_000,
    audio: true,
    ...overrides,
  };
}

test("normalizes multiple consumers without closing either sink", () => {
  const registry = new ScrcpyStreamSessionRegistry();
  const first = fakeSink();
  const second = fakeSink();

  const firstOptions = registry.beginStream(streamOptions(first.sink));
  const secondOptions = registry.beginStream(streamOptions(second.sink));

  assert.equal(firstOptions.control, true);
  assert.equal(secondOptions.control, true);
  assert.deepEqual(first.closes, []);
  assert.deepEqual(second.closes, []);
});

test("audio-disabled cache downgrades the next audio stream for the session", () => {
  const registry = new ScrcpyStreamSessionRegistry();
  const client = fakeSink();

  registry.markAudioDisabled("session-1");
  const options = registry.beginStream(streamOptions(client.sink));

  assert.equal(options.audio, false);
  assert.equal(options.compatibilityMode, "audio-disabled");
});

test("explicit video-only stream clears the audio-disabled session cache", () => {
  const registry = new ScrcpyStreamSessionRegistry();
  const client = fakeSink();

  registry.markAudioDisabled("session-1");
  registry.beginStream(streamOptions(client.sink, { audio: false }));

  assert.equal(registry.isAudioDisabled("session-1"), false);
});

test("closing a session clears audio-disabled state", () => {
  const registry = new ScrcpyStreamSessionRegistry();
  const client = fakeSink();

  registry.markAudioDisabled("session-1");
  registry.beginStream(streamOptions(client.sink, { audio: false }));
  registry.markAudioDisabled("session-1");
  registry.closeSession("session-1");

  assert.equal(registry.isAudioDisabled("session-1"), false);
});
