import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { NotFoundException } from "@nestjs/common";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import type { IncomingHttpHeaders } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { ScrcpySourceStream } from "../scrcpy/scrcpy-source-stream";
import { ScrcpyService } from "../scrcpy/scrcpy.service";
import type {
  ScrcpyAttemptResult,
  ScrcpyStreamOptions,
} from "../scrcpy/scrcpy.types";
import { SidecarFeatureService } from "../shared/sidecar-feature.service";
import { DisplayWebrtcService } from "./display-webrtc.service";

const offer = {
  sessionId: "display",
  headers: { host: "rebroid.test", "x-rebroid-viewer-id": "a".repeat(32) },
  sdp: "fixture",
  audio: false,
};

const setup = (
  scrcpy: object,
  config = {},
  webrtcEnabled = true,
  beforeAdmission?: (
    headers: IncomingHttpHeaders,
    signal?: AbortSignal,
  ) => Promise<void>,
) => {
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
    { webrtcUdpPort: 40000, sessionMaxActive: 64, ...config } as never,
    {} as never,
    features,
    {
      admit: async (
        _id: string,
        headers: IncomingHttpHeaders,
        signal?: AbortSignal,
      ) => {
        await beforeAdmission?.(headers, signal);
        if (headers.cookie === "different account") {
          throw new NotFoundException("Display session not found.");
        }
        return {
          session: { udid: "fixture", capabilities: ["video", "audio"] },
          accountSessionKey: headers.cookie ?? "first-browser",
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

// Test the sidecar through the same private sockets as the Go bridge.
const bridgeScript = (
  body: string,
  retire = "finish();",
) => `#!${process.execPath}
const fs = require("node:fs");
const peers = new Map();
const reply = (type, attemptId) => console.log(JSON.stringify({ type, attemptId }));
const control = require("node:readline").createInterface({ input: process.stdin });
control.on("line", (line) => {
  const { type, attemptId } = JSON.parse(line);
  const id = attemptId.replaceAll("-", "");
  if (type === "register") {
    if (peers.size >= Number(process.argv[4])) return reply("rejected", attemptId);
    peers.set(id, []);
    reply("registered", attemptId);
  } else if (type === "retire") {
    const streams = peers.get(id);
    if (!streams) return;
    streams.forEach(stream => stream.destroy());
    const finish = () => {
      peers.delete(id);
      reply("released", attemptId);
    };
    ${retire}
  }
});
control.on("close", () => process.exit(0));
require("node:net").createServer({ allowHalfOpen: true }, (socket) => {
  socket.on("error", () => socket.destroy());
  socket.once("readable", function readHeader() {
    const header = socket.read(17);
    if (!header) {
      socket.once("readable", readHeader);
      return;
    }
    const id = header.subarray(0, 16).toString("hex");
    const streams = peers.get(id);
    if (!streams) return socket.destroy();
    streams[header[16]] = socket;
    if (![0, 1, 2].every(index => streams[index])) return;
    const [commands, video, audio] = streams;
    commands.on("end", () => streams.forEach(stream => stream.destroy()));
    const input = require("node:readline").createInterface({ input: commands });
    const send = message => commands.write(JSON.stringify(message) + "\\n");
    ${body}
  });
}).listen(process.argv[2], () => console.log("ready"));
`;

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test("an abandoned offer waiting for authorization cannot replace a newer peer", async (t) => {
  const authorizationStarted = deferred();
  const authorize = deferred();
  const attached = deferred();
  const abandoned = new AbortController();
  let attaches = 0;
  let detaches = 0;
  const service = setup(
    {
      attachStream: () => {
        attaches += 1;
        attached.resolve();
        return {
          awaitVideoBootstrap: () => new Promise(() => undefined),
          detach: () => {
            detaches += 1;
          },
        };
      },
    },
    {},
    true,
    async (headers, signal) => {
      if (headers.cookie !== "abandoned") return;
      assert.equal(signal, abandoned.signal);
      authorizationStarted.resolve();
      // Simulate an authorization adapter that can finish after cancellation.
      await authorize.promise;
    },
  );
  t.after(() => service.onModuleDestroy());
  const old = assert.rejects(
    service.createAnswer({
      ...offer,
      headers: { ...offer.headers, cookie: "abandoned" },
      signal: abandoned.signal,
    }),
    { name: "AbortError" },
  );
  await authorizationStarted.promise;
  const current = assert.rejects(service.createAnswer(offer), /cancelled/);
  await attached.promise;
  abandoned.abort();
  authorize.resolve();
  await old;
  assert.equal(attaches, 1);
  assert.equal(detaches, 0);
  service.stopSession(offer.sessionId);
  await current;
  assert.equal(detaches, 1);
});

test("aborting a bootstrap detaches only its consumer and allows a fresh offer", async (t) => {
  const attachments = [deferred(), deferred()];
  const detached: number[] = [];
  let attaches = 0;
  const service = setup({
    attachStream: () => {
      const index = attaches++;
      attachments[index]!.resolve();
      return {
        awaitVideoBootstrap: () => new Promise(() => undefined),
        detach: () => {
          detached.push(index);
        },
      };
    },
  });
  t.after(() => service.onModuleDestroy());
  const abandoned = new AbortController();
  const first = assert.rejects(
    service.createAnswer({
      ...offer,
      signal: abandoned.signal,
    }),
    { name: "AbortError" },
  );
  await attachments[0]!.promise;
  abandoned.abort();
  await first;
  assert.deepEqual(detached, [0]);

  const second = assert.rejects(service.createAnswer(offer), /cancelled/);
  await attachments[1]!.promise;
  assert.deepEqual(detached, [0]);
  service.stopSession(offer.sessionId);
  await second;
  assert.deepEqual(detached, [0, 1]);
});

test("session release during source compatibility prevents capture launch", async (t) => {
  const probe = deferred();
  const started = deferred();
  const scrcpy = new ScrcpyService(
    {} as never,
    { scrcpyVersion: "5.0.1" } as never,
  );
  const service = setup(scrcpy);
  t.after(() => {
    service.onModuleDestroy();
    scrcpy.onModuleDestroy();
  });
  scrcpy["collectCompatibilityProbe"] = async () => {
    started.resolve();
    await probe.promise;
    return null;
  };
  const capture = t.mock.fn(async () => {
    throw new Error("unexpected capture launch");
  });
  scrcpy["streamRawVideoAttempt"] = capture;
  const pending = assert.rejects(service.createAnswer(offer), /cancelled/);
  await started.promise;
  service.stopSession(offer.sessionId);
  await pending;
  probe.resolve();
  await delay(0);
  assert.equal(capture.mock.callCount(), 0);
});

async function compatibilityFixture(t: TestContext, sdk: number) {
  const directory = await mkdtemp(join(tmpdir(), "rebroid-adb-compatibility-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await Promise.all([
    writeFile(
      join(directory, "getprop"),
      `#!/bin/sh\ncase "$1" in\n  ro.build.version.sdk) echo ${sdk} ;;\n  ro.build.version.release) echo 16 ;;\nesac\n`,
      { mode: 0o700 },
    ),
    ...["service", "cmd"].map((name) =>
      writeFile(join(directory, name), "#!/bin/sh\nexit 0\n", {
        mode: 0o700,
      }),
    ),
  ]);

  const shell = t.mock.fn(async (_udid: string, args: string[]) => ({
    // Replay the ADB CLI's remote argument join against a guest shell fixture.
    stdout: execFileSync("/bin/sh", ["-c", args.join(" ")], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
    }),
  }));
  const logcat = t.mock.fn(async () => ({ stdout: "" }));
  const scrcpy = new ScrcpyService(
    { shell, logcat } as never,
    { scrcpyVersion: "5.0.1" } as never,
  );
  const service = setup(scrcpy);
  t.after(() => {
    service.onModuleDestroy();
    scrcpy.onModuleDestroy();
  });
  return { scrcpy, service, shell, logcat };
}

test("WebRTC probes compatibility once for a shared scrcpy source", async (t) => {
  const { scrcpy, service, shell, logcat } = await compatibilityFixture(t, 36);
  const capture = t.mock.fn(
    (
      options: ScrcpyStreamOptions,
      registerStop: (stop: () => Promise<void>) => void,
    ) => {
      options.sink.writeVideo({
        config: true,
        keyFrame: false,
        timestampUs: 10n,
        data: Buffer.from(
          "000000016742c01fda0280b7fe5c050505020000000168ce06e2",
          "hex",
        ),
      });
      options.sink.writeVideo({
        config: false,
        keyFrame: true,
        timestampUs: 11n,
        data: Buffer.from("00000001658884", "hex"),
      });
      return new Promise<ScrcpyAttemptResult>((resolve) => {
        registerStop(async () => {
          resolve({ reason: "stopped", durationMs: 0, bytesForwarded: 0 });
        });
      });
    },
  );
  scrcpy["streamRawVideoAttempt"] = capture;

  await assert.rejects(
    service.createAnswer(offer),
    /Browser does not offer H.264/,
  );
  await assert.rejects(
    service.createAnswer(offer),
    /Browser does not offer H.264/,
  );
  assert.equal(capture.mock.callCount(), 1);
  assert.equal(shell.mock.callCount(), 1);
  assert.equal(logcat.mock.callCount(), 1);
});

test("a quoted compatibility probe rejects an unsupported Android SDK before capture", async (t) => {
  const { scrcpy, service, shell, logcat } = await compatibilityFixture(t, 37);
  const capture = t.mock.fn(async () => {
    throw new Error("unexpected capture launch");
  });
  scrcpy["streamRawVideoAttempt"] = capture;
  await assert.rejects(
    service.createAnswer(offer),
    /is not supported by Rebroid/,
  );
  assert.equal(capture.mock.callCount(), 0);
  assert.equal(shell.mock.callCount(), 1);
  assert.equal(logcat.mock.callCount(), 1);
});

test("a new offer replaces only its predecessor's bootstrap attachment", async () => {
  const attached = [deferred(), deferred()];
  const detached: number[] = [];
  const bootstrap = new Promise<never>(() => undefined);
  let attachments = 0;
  const service = setup({
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
  const retiredRequest = new AbortController();
  const first = assert.rejects(
    service.createAnswer({ ...offer, signal: retiredRequest.signal }),
    /cancelled/,
  );
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
  retiredRequest.abort();
  assert.deepEqual(detached, [0]);
  service.stopSession(offer.sessionId);
  await second;
  assert.deepEqual(detached, [0, 1]);
});

test("independent viewers can share a grant and retry at capacity without evicting a sibling", async (t) => {
  const attached = [deferred(), deferred(), deferred()];
  const detach = t.mock.fn<(index: number) => void>();
  let attachments = 0;
  const service = setup(
    {
      attachStream: () => {
        const index = attachments++;
        attached[index]!.resolve();
        return {
          awaitVideoBootstrap: () => new Promise(() => undefined),
          detach: () => detach(index),
        };
      },
    },
    { sessionMaxActive: 1 },
  );
  t.after(() => service.onModuleDestroy());
  const first = assert.rejects(service.createAnswer(offer), /cancelled/);
  await attached[0]!.promise;
  const sibling = assert.rejects(
    service.createAnswer({
      ...offer,
      headers: { ...offer.headers, "x-rebroid-viewer-id": "b".repeat(32) },
    }),
    /cancelled/,
  );
  await attached[1]!.promise;
  assert.equal(detach.mock.callCount(), 0);
  await assert.rejects(
    service.createAnswer({
      ...offer,
      headers: { ...offer.headers, "x-rebroid-viewer-id": "c".repeat(32) },
    }),
    {
      response: {
        statusCode: 429,
        code: "display_peer_capacity_exceeded",
        message: "The display sidecar has reached its WebRTC viewer limit.",
      },
    },
  );
  assert.equal(attachments, 2);
  assert.equal(detach.mock.callCount(), 0);
  const retried = assert.rejects(service.createAnswer(offer), /cancelled/);
  await attached[2]!.promise;
  await first;
  assert.deepEqual(
    detach.mock.calls.map(({ arguments: args }) => args[0]),
    [0],
  );

  service.stopSession(offer.sessionId);
  await Promise.all([sibling, retried]);
  assert.deepEqual(
    detach.mock.calls.map(({ arguments: args }) => args[0]).sort(),
    [0, 1, 2],
  );
});

async function replacementFixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "rebroid-webrtc-retirement-"));
  const executable = join(directory, "bridge");
  const retiring = join(directory, "retiring");
  const release = join(directory, "release");
  let codecGeneration = 0;
  let bootstrapSource: ScrcpySourceStream | undefined;
  const service = setup(
    {
      attachStream: ({ sink }: ScrcpyStreamOptions) =>
        bootstrapSource?.attach(sink, { mode: "bootstrap" }) ?? {
          awaitVideoBootstrap: async () => {
            const generation = codecGeneration;
            return {
              profileLevelId: "42c01f",
              sdpFmtpLine: "packetization-mode=1;profile-level-id=42c01f",
              width: 720,
              height: 1280,
              isCurrent: () => codecGeneration === generation,
            };
          },
          detach: () => undefined,
        },
    },
    { sessionMaxActive: 1, webrtcBridgePath: executable },
  );
  t.after(async () => {
    service.onModuleDestroy();
    bootstrapSource?.close();
    await rm(directory, { recursive: true, force: true });
  });
  await writeFile(
    executable,
    bridgeScript(
      `input.once("line", () => send({ type: "answer", sdp: id }));`,
      `
fs.writeFileSync(${JSON.stringify(retiring)}, attemptId);
const timer = setInterval(() => {
  if (!fs.existsSync(${JSON.stringify(release)})) return;
  clearInterval(timer);
  finish();
}, 10);
`,
    ),
    { mode: 0o700 },
  );
  const request = {
    ...offer,
    sdp: [
      "m=video 9 UDP/TLS/RTP/SAVPF 96",
      "a=rtpmap:96 H264/90000",
      "a=fmtp:96 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
    ].join("\r\n"),
  };
  const forViewer = (id: string) => ({
    ...request,
    headers: { ...request.headers, "x-rebroid-viewer-id": id.repeat(32) },
  });
  const first = await service.createAnswer(request);
  const sibling = await service.createAnswer(forViewer("b"));
  return {
    service,
    request,
    first,
    sibling,
    forViewer,
    changeCodecGeneration: () => {
      codecGeneration += 1;
    },
    waitForCodecBootstrap: () => {
      bootstrapSource = new ScrcpySourceStream(
        () => undefined,
        () => undefined,
        () => true,
      );
    },
    confirmRetirement: () => writeFile(release, ""),
    async waitForRetirement() {
      const deadline = Date.now() + 3_000;
      while (true) {
        try {
          await access(retiring);
          return;
        } catch (error) {
          if (Date.now() >= deadline) throw error;
          await delay(10);
        }
      }
    },
  };
}

test("the newest replacement waits for Go retirement and inherits the viewer slot", async (t) => {
  const fixture = await replacementFixture(t);
  const { service, request } = fixture;
  const superseded = assert.rejects(service.createAnswer(request), /cancelled/);
  void superseded.catch(() => undefined);
  await fixture.waitForRetirement();

  const replacement = service.createAnswer(request);
  void replacement.catch(() => undefined);
  await superseded;
  const waiting = Symbol("waiting for Go");
  assert.equal(await Promise.race([replacement, delay(25, waiting)]), waiting);
  await assert.rejects(service.createAnswer(fixture.forViewer("c")), {
    status: 429,
  });
  await fixture.confirmRetirement();
  const answer = await replacement;
  assert.notEqual(answer.sdp, fixture.first.sdp);
  assert.notEqual(answer.sdp, fixture.sibling.sdp);
  await assert.rejects(service.createAnswer(fixture.forViewer("c")), {
    status: 429,
  });
});

test("a timed-out replacement keeps the retiring peer counted until Go confirms", async (t) => {
  const fixture = await replacementFixture(t);
  const { service, request } = fixture;
  const assertTimedOut = (answer: ReturnType<typeof service.createAnswer>) =>
    assert.rejects(answer, {
      response: {
        statusCode: 503,
        code: "display_peer_retirement_timeout",
        message: "The previous WebRTC peer is still closing. Retry the offer.",
      },
    });
  await assertTimedOut(service.createAnswer(request));
  await assert.rejects(service.createAnswer(fixture.forViewer("c")), {
    status: 429,
  });
  const waiting = Symbol("cleanup deadline restarted");
  assert.equal(
    await Promise.race([
      assertTimedOut(service.createAnswer(request)),
      delay(500, waiting, { ref: false }),
    ]),
    undefined,
  );

  await fixture.confirmRetirement();
  const deadline = Date.now() + 3_000;
  while (true) {
    try {
      assert.notEqual(
        (await service.createAnswer(request)).sdp,
        fixture.first.sdp,
      );
      break;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await delay(10);
    }
  }
});

test("a replacement cannot negotiate from a codec generation retired during peer cleanup", async (t) => {
  const fixture = await replacementFixture(t);
  const { service, request } = fixture;
  const stale = assert.rejects(service.createAnswer(request), {
    message:
      "The video codec generation changed while waiting for WebRTC peer cleanup.",
    status: 503,
  });
  void stale.catch(() => undefined);
  await fixture.waitForRetirement();
  fixture.changeCodecGeneration();
  await fixture.confirmRetirement();
  await stale;
  assert.notEqual((await service.createAnswer(request)).sdp, fixture.first.sdp);
});

test("bootstrap timeout returns a retryable error while the previous peer is retiring", async (t) => {
  const fixture = await replacementFixture(t);
  const { service, request } = fixture;
  fixture.waitForCodecBootstrap();
  const replacement = assert.rejects(service.createAnswer(request), {
    response: {
      statusCode: 503,
      code: "display_video_bootstrap_timeout",
      message: "Timed out waiting 3000ms for H.264 configuration and IDR",
    },
  });
  void replacement.catch(() => undefined);
  await fixture.waitForRetirement();
  await replacement;
  await assert.rejects(service.createAnswer(fixture.forViewer("c")), {
    status: 429,
  });
});

test("the same viewer ID from a different authorized account session does not replace its peer", async (t) => {
  const attached = [deferred(), deferred()];
  const detach = t.mock.fn();
  let attachments = 0;
  const service = setup({
    attachStream: () => {
      attached[attachments++]!.resolve();
      return {
        awaitVideoBootstrap: () => new Promise(() => undefined),
        detach,
      };
    },
  });
  t.after(() => service.onModuleDestroy());
  const first = assert.rejects(service.createAnswer(offer), /cancelled/);
  await attached[0]!.promise;
  const second = assert.rejects(
    service.createAnswer({
      ...offer,
      headers: { ...offer.headers, cookie: "second-browser" },
    }),
    /cancelled/,
  );
  await attached[1]!.promise;
  assert.equal(detach.mock.callCount(), 0);
  service.stopSession(offer.sessionId);
  await Promise.all([first, second]);
  assert.equal(detach.mock.callCount(), 2);
});

test("an older offer cannot replace a newer offer when authorization resolves out of order", async (t) => {
  const authorize = deferred();
  const waiting = deferred();
  const attached = deferred();
  let authorizations = 0;
  let attachments = 0;
  const service = setup(
    {
      attachStream: () => {
        attachments++;
        attached.resolve();
        return {
          awaitVideoBootstrap: () => new Promise(() => undefined),
          detach: () => undefined,
        };
      },
    },
    {},
    true,
    async () => {
      if (authorizations++ === 0) {
        waiting.resolve();
        await authorize.promise;
      }
    },
  );
  t.after(() => service.onModuleDestroy());
  const old = assert.rejects(service.createAnswer(offer), /newer offer/);
  await waiting.promise;
  const current = assert.rejects(service.createAnswer(offer), /cancelled/);
  await attached.promise;
  authorize.resolve();
  await old;
  assert.equal(attachments, 1);
  service.stopSession(offer.sessionId);
  await current;
});

test("release during bridge signaling detaches bootstrap without attaching a media sink", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rebroid-webrtc-attempt-"));
  const executable = join(directory, "bridge");
  const started = join(directory, "started");
  await writeFile(
    executable,
    bridgeScript(`
input.once("line", () => {
  fs.writeFileSync(${JSON.stringify(started)}, "");
});
`),
    { mode: 0o700 },
  );
  let attachments = 0;
  let detaches = 0;
  const service = setup(
    {
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
    service.onModuleDestroy();
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
      attachStream: ({ sink }: ScrcpyStreamOptions) => source.attach(sink),
    },
    { webrtcBridgePath: executable },
  );
  t.after(async () => {
    service.onModuleDestroy();
    source.close();
    await rm(directory, { recursive: true, force: true });
  });
  await writeFile(
    executable,
    bridgeScript(`
video.once("data", (data) => {
  fs.writeFileSync(${JSON.stringify(receivedVideo)}, data);
});
input.once("line", (line) => {
  fs.writeFileSync(${JSON.stringify(receivedOffer)}, line);
  const timer = setInterval(() => {
    if (!fs.existsSync(${JSON.stringify(sendAnswer)})) return;
    clearInterval(timer);
    send({ type: "answer", sdp: "fixture answer" });
    const connecting = setInterval(() => {
      if (!fs.existsSync(${JSON.stringify(sendConnected)})) return;
      clearInterval(connecting);
      send({ type: "state", state: "connected" });
    }, 10);
  }, 10);
});
`),
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
  assert.equal(resets, 0, "the current configuration and IDR were replayed");
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
      attachStream: ({ sink }: ScrcpyStreamOptions) => source.attach(sink),
    },
    { webrtcBridgePath: executable },
  );
  t.after(async () => {
    service.onModuleDestroy();
    source.close();
    await rm(directory, { recursive: true, force: true });
  });
  await writeFile(
    executable,
    bridgeScript(`
input.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.type === "offer") {
    audio.destroy();
    send({ type: "answer", sdp: "fixture answer" });
    send({ type: "state", state: "connected" });
  }
  if (message.payload?.type === "webrtc-profile") {
    fs.writeFileSync(${JSON.stringify(attached)}, "");
  }
  if (message.payload?.type === "audio-disabled") {
    fs.writeFileSync(${JSON.stringify(disabled)}, "");
  }
});
`),
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
