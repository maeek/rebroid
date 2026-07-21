import assert from "node:assert/strict";
import test from "node:test";
import { ScrcpyStreamSessionRegistry } from "./scrcpy-stream-session-registry";
import type { ScrcpyStreamClient, ScrcpyStreamOptions } from "./scrcpy.types";

function fakeClient() {
  const closes: Array<{ code?: number; reason?: string }> = [];
  const client: ScrcpyStreamClient = {
    readyState: 1,
    bufferedAmount: 0,
    once: () => undefined,
    send: () => undefined,
    close: (code?: number, reason?: string) => {
      closes.push({ code, reason });
    },
  };
  return { client, closes };
}

function streamOptions(
  client: ScrcpyStreamClient,
  overrides: Partial<ScrcpyStreamOptions> = {},
): ScrcpyStreamOptions {
  return {
    sessionId: "session-1",
    udid: "device-1",
    client,
    codec: "h264",
    maxSize: 1080,
    maxFps: 30,
    bitrate: 3_000_000,
    audio: true,
    ...overrides,
  };
}

test("replacing a session closes the previous stream client", () => {
  const registry = new ScrcpyStreamSessionRegistry();
  const first = fakeClient();
  const second = fakeClient();

  const firstOptions = registry.beginStream(streamOptions(first.client));
  const secondOptions = registry.beginStream(streamOptions(second.client));

  assert.equal(firstOptions.control, true);
  assert.equal(secondOptions.control, true);
  assert.deepEqual(first.closes, [
    { code: 1012, reason: "Display stream replaced" },
  ]);
  assert.deepEqual(second.closes, []);
});

test("audio-disabled cache downgrades the next audio stream for the session", () => {
  const registry = new ScrcpyStreamSessionRegistry();
  const client = fakeClient();

  registry.markAudioDisabled("session-1");
  const options = registry.beginStream(streamOptions(client.client));

  assert.equal(options.audio, false);
  assert.equal(options.compatibilityMode, "audio-disabled");
});

test("explicit video-only stream clears the audio-disabled session cache", () => {
  const registry = new ScrcpyStreamSessionRegistry();
  const client = fakeClient();

  registry.markAudioDisabled("session-1");
  registry.beginStream(streamOptions(client.client, { audio: false }));

  assert.equal(registry.isAudioDisabled("session-1"), false);
});

test("clearing an old client does not remove a replacement client", () => {
  const registry = new ScrcpyStreamSessionRegistry();
  const first = fakeClient();
  const second = fakeClient();

  registry.beginStream(streamOptions(first.client));
  registry.beginStream(streamOptions(second.client));
  registry.clearStreamClient("session-1", first.client);
  registry.closeSession("session-1");

  assert.deepEqual(second.closes, [
    { code: 1000, reason: "Display session released" },
  ]);
});

test("closing a session clears audio-disabled state", () => {
  const registry = new ScrcpyStreamSessionRegistry();
  const client = fakeClient();

  registry.markAudioDisabled("session-1");
  registry.beginStream(streamOptions(client.client, { audio: false }));
  registry.markAudioDisabled("session-1");
  registry.closeSession("session-1");

  assert.equal(registry.isAudioDisabled("session-1"), false);
});
