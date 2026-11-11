import assert from "node:assert/strict";
import { NotFoundException } from "@nestjs/common";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { IncomingHttpHeaders } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { ScrcpySourceStream } from "../scrcpy/scrcpy-source-stream";
import type { ScrcpyStreamOptions } from "../scrcpy/scrcpy.types";
import { SidecarFeatureService } from "../shared/sidecar-feature.service";
import { DisplayWebrtcService } from "./display-webrtc.service";

const offer = {
  sessionId: "display",
  headers: { host: "rebroid.test" },
  sdp: "fixture",
  audio: false,
};

const setup = (scrcpy: object, config = {}, webrtcEnabled = true) => {
  const features = new SidecarFeatureService();
  features.apply({
    revision: 0,
    features: [
      { key: "feature.display-virtual", effective: false },
      { key: "feature.display-webrtc", effective: webrtcEnabled },
    ],
  });
  return new DisplayWebrtcService(
    {
      assertCapability: () => undefined,
    } as never,
    scrcpy as never,
    config as never,
    {} as never,
    features,
    {
      admit: async (_id: string, headers: IncomingHttpHeaders) => {
        if (headers.cookie === "different account") {
          throw new NotFoundException("Display session not found.");
        }
        return {
          session: { udid: "fixture", capabilities: ["video", "audio"] },
          watch: () => () => undefined,
        };
      },
    } as never,
  );
};

test("disabled WebRTC rejects offers before probing or attaching a source", async () => {
  const service = setup({}, {}, false);
  await assert.rejects(
    service.createAnswer(offer),
    /WebRTC streaming is disabled/,
  );
});

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test("session release cancels an offer during target preparation", async () => {
  const probe = deferred();
  const started = deferred();
  let attachments = 0;
  const service = setup({
    assertTargetSupported: () => {
      started.resolve();
      return probe.promise;
    },
    attachStream: () => {
      attachments += 1;
    },
  });
  const pending = assert.rejects(service.createAnswer(offer), /cancelled/);
  await started.promise;
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
  await assert.rejects(
    service.createAnswer({
      ...offer,
      headers: { ...offer.headers, cookie: "different account" },
    }),
    /Display session not found/,
  );
  assert.deepEqual(detached, []);
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

test("WebRTC waits for the peer and never attaches media from a different codec generation", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "rebroid-webrtc-codec-"));
  const executable = join(directory, "bridge");
  const receivedOffer = join(directory, "offer");
  const sendAnswer = join(directory, "answer");
  const sendConnected = join(directory, "connected");
  const receivedVideo = join(directory, "video");
  let resets = 0;
  const source = new ScrcpySourceStream(
    () => undefined,
    () => undefined,
    () => {
      resets += 1;
      return true;
    },
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
fs.createReadStream(null, { fd: 3 }).once("data", (data) => {
  fs.writeFileSync(${JSON.stringify(receivedVideo)}, data);
});
input.once("line", (line) => {
  fs.writeFileSync(${JSON.stringify(receivedOffer)}, line);
  const timer = setInterval(() => {
    if (!fs.existsSync(${JSON.stringify(sendAnswer)})) return;
    clearInterval(timer);
    console.log(JSON.stringify({ type: "answer", sdp: "fixture answer" }));
    const connecting = setInterval(() => {
      if (!fs.existsSync(${JSON.stringify(sendConnected)})) return;
      clearInterval(connecting);
      console.log(JSON.stringify({ type: "state", state: "connected" }));
    }, 10);
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

  const staleAnswer = await service.createAnswer(request);
  assert.equal(staleAnswer.profileLevelId, "42c01f");
  writeConfigAndIdr("20", 30n);
  await writeFile(sendConnected, "");
  const detachDeadline = Date.now() + 3_000;
  while (source.consumerCount() !== 0 && Date.now() < detachDeadline) {
    await delay(10);
  }
  assert.equal(source.consumerCount(), 0);
  assert.equal(resets, 0);
  await assert.rejects(access(receivedVideo), { code: "ENOENT" });
  await rm(sendConnected);

  const answer = await service.createAnswer(request);
  assert.equal(answer.profileLevelId, "42c020");
  assert.equal(source.consumerCount(), 1);
  assert.equal(resets, 0, "bootstrap has not attached a media consumer");
  await assert.rejects(access(receivedVideo), { code: "ENOENT" });
  await writeFile(sendConnected, "");
  const mediaDeadline = Date.now() + 3_000;
  while (true) {
    try {
      await access(receivedVideo);
      break;
    } catch (error) {
      if (Date.now() >= mediaDeadline) throw error;
      await delay(10);
    }
  }
  assert.equal(resets, 1);
  assert.equal(source.consumerCount(), 1);
});

test("losing the bridge audio pipe leaves the video consumer attached", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "rebroid-webrtc-audio-"));
  const executable = join(directory, "bridge");
  const disabled = join(directory, "audio-disabled");
  const attached = join(directory, "media-attached");
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
input.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.type === "offer") {
    fs.closeSync(4);
    console.log(JSON.stringify({ type: "answer", sdp: "fixture answer" }));
    console.log(JSON.stringify({ type: "state", state: "connected" }));
  }
  if (message.payload?.type === "webrtc-profile") {
    fs.writeFileSync(${JSON.stringify(attached)}, "");
  }
  if (message.payload?.type === "audio-disabled") {
    fs.writeFileSync(${JSON.stringify(disabled)}, "");
  }
});
`,
    { mode: 0o700 },
  );
  source.writeVideo({
    config: true,
    keyFrame: false,
    timestampUs: 10n,
    data: Buffer.from(
      "000000016742c01fda0280b7fe5c050505020000000168ce06e2",
      "hex",
    ),
  });
  source.writeVideo({
    config: false,
    keyFrame: true,
    timestampUs: 11n,
    data: Buffer.from("00000001658884", "hex"),
  });
  await service.createAnswer({
    ...offer,
    audio: true,
    sdp: [
      "m=video 9 UDP/TLS/RTP/SAVPF 96",
      "a=rtpmap:96 H264/90000",
      "a=fmtp:96 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
    ].join("\r\n"),
  });

  const attachDeadline = Date.now() + 3_000;
  while (true) {
    try {
      await access(attached);
      break;
    } catch (error) {
      if (Date.now() >= attachDeadline) throw error;
      await delay(10);
    }
  }
  source.writeAudio({
    data: Buffer.from([1]),
    config: false,
    timestampUs: 11n,
  });
  const deadline = Date.now() + 3_000;
  while (true) {
    try {
      await access(disabled);
      break;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await delay(10);
    }
  }
  assert.equal(source.consumerCount(), 1);
  assert.equal(source.isOpen(), true);
});
