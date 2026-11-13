import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { Duplex, PassThrough } from "node:stream";
import test from "node:test";
import { ScrcpyService } from "./scrcpy.service";
import type { ScrcpyMediaSink } from "./scrcpy.types";

function capture() {
  const video = new PassThrough();
  const controlBytes: number[] = [];
  const control = Object.assign(
    new Duplex({
      read() {},
      write(chunk: Buffer, _encoding, done) {
        controlBytes.push(...chunk);
        done();
      },
    }),
    {
      setNoDelay: () => undefined,
    },
  );
  return { video, control, controlBytes, reading: once(video, "resume") };
}

function videoPacket(flags: bigint, payload: string) {
  const data = Buffer.from(payload, "hex");
  const header = Buffer.alloc(12);
  header.writeBigUInt64BE(flags);
  header.writeUInt32BE(data.length, 8);
  return Buffer.concat([header, data]);
}

test(
  "a cold or restarted capture receives no reset before configuration and IDR",
  { timeout: 2_000 },
  async (t) => {
    const first = capture();
    const replacement = capture();
    let current = first;
    const service = new ScrcpyService(
      { ensureConnected: async () => undefined } as never,
      {
        scrcpyVersion: "5.0.1",
        scrcpyControlChannel: true,
        scrcpyTunnelMode: "direct",
      } as never,
    );
    service["collectCompatibilityProbe"] = async () => null;
    service["ensureScrcpyServerPushed"] = async () => undefined;
    service["startServer"] = () => ({
      process: Object.assign(new EventEmitter(), {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        kill: () => undefined,
      }) as never,
      detached: false,
    });
    service["connectToDirectAdbConnection"] = async () =>
      ({ destroy: () => undefined }) as never;
    service["connectToDirectAdbVideoSocket"] = async () => ({
      socket: current.video as never,
      initialPayload: Buffer.from("h264"),
    });
    service["connectToDirectAdbSocket"] = async () => current.control as never;
    service["delay"] = async () => undefined;
    t.after(() => service.closeSession("display"));

    const statuses: Record<string, unknown>[] = [];
    const sink: ScrcpyMediaSink = {
      isOpen: () => true,
      onClose: () => undefined,
      sendStatus: (status) => statuses.push(status as Record<string, unknown>),
      writeVideo: (_packet, done) => done?.(),
      writeAudio: (_packet, done) => done?.(),
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
    };
    const attachment = service.attachStream({
      sessionId: "display",
      udid: "fixture",
      sink,
      codec: "h264",
      audio: false,
      maxSize: 0,
      maxFps: 60,
      bitrate: 14_000_000,
    });

    await first.reading;
    assert.deepEqual(
      first.controlBytes,
      [],
      "opening control does not reset an unready capture",
    );
    assert.equal(attachment.requestVideoReset("websocket:resync"), false);
    const config = videoPacket(1n << 62n, "000000016742e01f0000000168ce06e2");
    const idr = videoPacket((1n << 61n) | 42n, "00000001658884");
    first.video.write(config);
    assert.equal(attachment.requestVideoReset("webrtc:pli"), false);
    first.video.write(idr);
    await attachment.awaitVideoBootstrap();
    assert.deepEqual(
      first.controlBytes,
      [],
      "the initial IDR satisfies cold attachment",
    );
    assert.equal(attachment.requestVideoReset("webrtc:pli"), true);
    assert.deepEqual(first.controlBytes, [17]);
    await new Promise<void>((resolve) => setImmediate(resolve));
    const requested = statuses.find((status) => status.type === "video-reset");
    assert.ok(requested);
    assert.equal(requested.sourceAttemptId, attachment.sourceAttemptId);
    assert.equal(requested.generation, 1);
    assert.equal(typeof requested.codecGeneration, "number");
    first.video.write(config);
    first.video.write(idr);
    first.video.write(idr);
    const completed = statuses.filter(
      (status) => status.type === "video-reset-complete",
    );
    assert.equal(completed.length, 1, "one completion for the requested reset");
    assert.equal(completed[0].sourceAttemptId, requested.sourceAttemptId);
    assert.equal(completed[0].generation, requested.generation);
    assert.equal(completed[0].codecGeneration, requested.codecGeneration);
    assert.equal(typeof completed[0].elapsedMs, "number");
    assert.ok(Number(completed[0].elapsedMs) >= 0);

    current = replacement;
    first.video.destroy();
    await replacement.reading;
    assert.equal(attachment.requestVideoReset("websocket:resync"), false);
    assert.deepEqual(replacement.controlBytes, []);
  },
);
