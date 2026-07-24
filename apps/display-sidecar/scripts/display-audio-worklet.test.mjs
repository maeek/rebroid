import assert from "node:assert/strict";
import test from "node:test";

test("audio worklet bounds latency, drops oldest audio, and emits silence on underflow", async () => {
  let Processor;
  globalThis.sampleRate = 48_000;
  globalThis.AudioWorkletProcessor = class {
    constructor() {
      this.port = { onmessage: null };
    }
  };
  globalThis.registerProcessor = (_name, candidate) => {
    Processor = candidate;
  };
  await import(
    new URL(
      "../dist/modules/display/viewer/assets/display-audio-worklet.js",
      import.meta.url,
    )
  );
  const processor = new Processor();
  const channel = new MessageChannel();
  const reports = [];
  channel.port2.onmessage = (event) => reports.push(event.data);
  channel.port2.start();
  processor.port.onmessage({
    data: { type: "connect", port: channel.port1 },
  });

  const frames = 4_000;
  const left = new Float32Array(frames).fill(0.5);
  const right = new Float32Array(frames).fill(-0.5);
  channel.port2.postMessage(
    {
      type: "pcm",
      timestampUs: 1_000_000,
      sampleRate: 48_000,
      numberOfFrames: frames,
      numberOfChannels: 2,
      discontinuity: true,
      planes: [left.buffer, right.buffer],
    },
    [left.buffer, right.buffer],
  );
  await new Promise((resolve) => setImmediate(resolve));

  const output = [[new Float32Array(128), new Float32Array(128)]];
  processor.process([], output);
  assert.equal(output[0][0][0], 0.5);
  assert.equal(output[0][1][0], -0.5);
  assert.equal(
    reports.some((report) => report.type === "audio-drops"),
    true,
  );

  channel.port2.postMessage({ type: "reset" });
  await new Promise((resolve) => setImmediate(resolve));
  const silence = [
    [new Float32Array(128).fill(1), new Float32Array(128).fill(1)],
  ];
  processor.process([], silence);
  assert.equal(
    silence[0][0].every((value) => value === 0),
    true,
  );
  assert.equal(
    silence[0][1].every((value) => value === 0),
    true,
  );
  channel.port2.close();
});
