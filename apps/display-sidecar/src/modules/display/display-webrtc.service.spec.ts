import assert from "node:assert/strict";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { ScrcpySourceStream } from "../scrcpy/scrcpy-source-stream";
import type { ScrcpyStreamOptions } from "../scrcpy/scrcpy.types";
import { DisplayWebrtcService } from "./display-webrtc.service";

const offer = {
  sessionId: "display",
  token: "test-token",
  requestHost: "rebroid.test",
  sdp: "fixture",
  audio: false,
};

const setup = (scrcpy: object, config = {}) =>
  new DisplayWebrtcService(
    {
      assertStreamToken: () => ({ udid: "fixture" }),
      assertCapability: () => undefined,
    } as never,
    scrcpy as never,
    config as never,
    {} as never,
  );

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test("session release cancels an offer during target preparation", async () => {
  const probe = deferred();
  let attachments = 0;
  const service = setup({
    assertTargetSupported: () => probe.promise,
    attachStream: () => {
      attachments += 1;
    },
  });
  const pending = assert.rejects(service.createAnswer(offer), /cancelled/);
  service.stopSession(offer.sessionId);
  await pending;
  probe.resolve();
  await Promise.resolve();
  assert.equal(attachments, 0);
});

test("a new offer replaces only its predecessor's bootstrap attachment", async () => {
  const attached = [deferred(), deferred()];
  const detached: number[] = [];
  const bootstrap = new Promise<never>(() => undefined);
  let attachments = 0;
  const service = setup({
    assertTargetSupported: () => Promise.resolve(),
    attachStream: () => {
      const index = attachments++;
      attached[index]!.resolve();
      return {
        awaitVideoBootstrap: () => bootstrap,
        detach: () => {
          detached.push(index);
        },
      };
    },
  });
  const first = assert.rejects(service.createAnswer(offer), /cancelled/);
  await attached[0]!.promise;
  const second = assert.rejects(service.createAnswer(offer), /cancelled/);
  await first;
  await attached[1]!.promise;
  assert.deepEqual(detached, [0]);
  service.stopSession(offer.sessionId);
  await second;
  assert.deepEqual(detached, [0, 1]);
});

test("release during bridge signaling detaches bootstrap without attaching a media sink", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rebroid-webrtc-attempt-"));
  const executable = join(directory, "bridge");
  const started = join(directory, "started");
  await writeFile(
    executable,
    `#!${process.execPath}
const { createInterface } = require("node:readline");
createInterface({ input: process.stdin }).once("line", () => {
  require("node:fs").writeFileSync(${JSON.stringify(started)}, "");
});
`,
    { mode: 0o700 },
  );
  let attachments = 0;
  let detaches = 0;
  const service = setup(
    {
      assertTargetSupported: () => Promise.resolve(),
      attachStream: () => {
        attachments += 1;
        return {
          awaitVideoBootstrap: () =>
            Promise.resolve({
              profileLevelId: "42c033",
              sdpFmtpLine: "packetization-mode=1;profile-level-id=42c033",
              width: 1080,
              height: 2340,
            }),
          detach: () => {
            detaches += 1;
          },
        };
      },
    },
    { webrtcBridgePath: executable },
  );

  const pending = assert.rejects(
    service.createAnswer({
      ...offer,
      sdp: [
        "m=video 9 UDP/TLS/RTP/SAVPF 96",
        "a=rtpmap:96 H264/90000",
        "a=fmtp:96 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
      ].join("\r\n"),
    }),
    /cancelled/,
  );
  try {
    const deadline = Date.now() + 3_000;
    while (true) {
      try {
        await access(started);
        break;
      } catch (error) {
        if (Date.now() >= deadline) throw error;
        await delay(10);
      }
    }
    service.stopSession(offer.sessionId);
    await pending;
    assert.equal(attachments, 1);
    assert.equal(detaches, 1);
  } finally {
    service.stopSession(offer.sessionId);
    await pending.catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

test("an offer cannot attach to a codec generation that changed during signaling", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "rebroid-webrtc-codec-"));
  const executable = join(directory, "bridge");
  const receivedOffer = join(directory, "offer");
  const sendAnswer = join(directory, "answer");
  const source = new ScrcpySourceStream(
    () => undefined,
    () => undefined,
    () => true,
  );
  const service = setup(
    {
      assertTargetSupported: () => Promise.resolve(),
      attachStream: ({ sink }: ScrcpyStreamOptions) => source.attach(sink),
    },
    { webrtcBridgePath: executable },
  );
  t.after(async () => {
    service.stopSession(offer.sessionId);
    source.close();
    await rm(directory, { recursive: true, force: true });
  });
  await writeFile(
    executable,
    `#!${process.execPath}
const fs = require("node:fs");
const input = require("node:readline").createInterface({ input: process.stdin });
input.once("line", (line) => {
  fs.writeFileSync(${JSON.stringify(receivedOffer)}, line);
  const timer = setInterval(() => {
    if (!fs.existsSync(${JSON.stringify(sendAnswer)})) return;
    clearInterval(timer);
    console.log(JSON.stringify({ type: "answer", sdp: "fixture answer" }));
  }, 10);
});
`,
    { mode: 0o700 },
  );

  const writeConfigAndIdr = (level: string, timestampUs: bigint) => {
    source.writeVideo({
      config: true,
      keyFrame: false,
      timestampUs,
      data: Buffer.from(
        `000000016742c0${level}da0280b7fe5c050505020000000168ce06e2`,
        "hex",
      ),
    });
    source.writeVideo({
      config: false,
      keyFrame: true,
      timestampUs: timestampUs + 1n,
      data: Buffer.from("00000001658884", "hex"),
    });
  };

  writeConfigAndIdr("1e", 10n);
  const request = {
    ...offer,
    sdp: [
      "m=video 9 UDP/TLS/RTP/SAVPF 96",
      "a=rtpmap:96 H264/90000",
      "a=fmtp:96 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
    ].join("\r\n"),
  };
  const pending = assert.rejects(service.createAnswer(request), {
    message: "The video codec generation changed during WebRTC negotiation.",
    status: 503,
  });
  void pending.catch(() => undefined);
  const deadline = Date.now() + 3_000;
  while (true) {
    try {
      await access(receivedOffer);
      break;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await delay(10);
    }
  }
  writeConfigAndIdr("1f", 20n);
  await writeFile(sendAnswer, "");

  await pending;
  assert.equal(source.consumerCount(), 0);
  assert.equal(source.isOpen(), true);

  const answer = await service.createAnswer(request);
  assert.equal(answer.profileLevelId, "42c01f");
  assert.equal(source.consumerCount(), 1);
});
