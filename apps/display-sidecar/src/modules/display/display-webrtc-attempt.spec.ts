import assert from "node:assert/strict";
import { test } from "node:test";
import { Logger } from "@nestjs/common";
import { ScrcpyBootstrapSink } from "../scrcpy/scrcpy-bootstrap-sink";
import { ScrcpySourceStream } from "../scrcpy/scrcpy-source-stream";
import { ScrcpyVideoResetWatchdog } from "../scrcpy/scrcpy-video-reset-watchdog";
import { scrcpyVideoConfigurationChangedCloseCode } from "../scrcpy/scrcpy.types";
import type {
  ScrcpyMediaSink,
  ScrcpyStreamAttachment,
  ScrcpyVideoBootstrap,
  ScrcpyVideoReset,
} from "../scrcpy/scrcpy.types";
import { DisplayWebrtcAttempt } from "./display-webrtc-attempt";
import type {
  WebrtcBridge,
  WebrtcBridgeMessage,
} from "./display-webrtc-bridge";

test("codec change notifies the current peer before bounded shutdown and fences retired controls", async (t) => {
  const debug = t.mock.method(Logger.prototype, "debug", () => undefined);
  let onMessage: (message: WebrtcBridgeMessage) => void = () => {
    throw new Error("Bridge is not listening");
  };
  let onOffer!: () => void;
  const offerSent = new Promise<void>((resolve) => {
    onOffer = resolve;
  });
  let rejectControl!: (error: Error) => void;
  const control = new Promise<never>((_, reject) => {
    rejectControl = reject;
  });
  let attached = 0;
  let detachedBootstrap = 0;
  let detachedMedia = 0;
  let closed = 0;
  let finished = 0;
  let dispatchedControls = 0;
  let resetRequests = 0;
  let bridgeAttemptId: string | undefined;
  const replies: unknown[] = [];
  let mediaSink: ScrcpyMediaSink | undefined;
  let finishMedia!: () => void;
  const mediaClosed = new Promise<void>((resolve) => {
    finishMedia = resolve;
  });
  const bridgeCloseListeners: Array<() => void> = [];
  let finishBridge!: () => void;
  const bridgeClosed = new Promise<void>((resolve) => {
    finishBridge = resolve;
  });
  const stream: ScrcpyStreamAttachment = {
    sourceAttemptId: "source",
    consumerId: "bootstrap",
    closed: new Promise(() => {}),
    detach: () => {
      detachedBootstrap += 1;
    },
    requestVideoReset: () => false,
    awaitVideoBootstrap: async () => bootstrap,
  };
  const bootstrap: ScrcpyVideoBootstrap = {
    isCurrent: () => true,
    attachMedia: (sink) => {
      attached += 1;
      mediaSink = sink;
      return {
        ...stream,
        consumerId: "media",
        closed: mediaClosed,
        detach: () => {
          detachedMedia += 1;
        },
        requestVideoReset: () => {
          resetRequests += 1;
          return true;
        },
      };
    },
    configuration: Buffer.alloc(0),
    keyFrame: Buffer.alloc(0),
    configurationTimestampUs: 0n,
    keyFrameTimestampUs: 1n,
    profileLevelId: "42c033",
    sdpFmtpLine: "packetization-mode=1;profile-level-id=42c033",
    width: 640,
    height: 480,
  };
  const bridge: WebrtcBridge = {
    isOpen: () => closed === 0,
    onClose: (listener) => bridgeCloseListeners.push(listener),
    listen: (callbacks) => {
      onMessage = callbacks.onMessage;
    },
    sendOffer: () => onOffer(),
    sendDataChannel: (message) => {
      replies.push(message);
    },
    writeVideo: async () => undefined,
    writeAudio: async () => undefined,
    stopAudio: () => undefined,
    close: () => {
      closed += 1;
      bridgeCloseListeners.forEach((listener) => listener());
      finishBridge();
    },
  };
  const attempt = new DisplayWebrtcAttempt({
    allowClipboard: false,
    sessionId: "session",
    sdp: [
      "m=video 9 UDP/TLS/RTP/SAVPF 96",
      "a=rtpmap:96 H264/90000",
      "a=fmtp:96 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
    ].join("\r\n"),
    iceHost: "localhost",
    maxFps: 30,
    audio: false,
    iceServers: [],
    attachSource: () => stream,
    launchBridge: (_signal, attemptId) => {
      bridgeAttemptId = attemptId;
      return bridge;
    },
    executeControl: () => {
      dispatchedControls += 1;
      return control;
    },
    onFinish: () => {
      finished += 1;
    },
  });

  try {
    const answer = attempt.run();
    await offerSent;
    onMessage({ type: "state", state: "connected" });
    assert.equal(attached, 0);
    onMessage({ type: "answer", sdp: "answer" });
    const response = await answer;
    assert.equal(response.sdp, "answer");
    assert.equal(response.consumerAttemptId, bridgeAttemptId);
    assert.equal(attached, 1);
    const profile = replies.find(
      (reply) => (reply as Record<string, unknown>).type === "webrtc-profile",
    ) as Record<string, unknown>;
    assert.equal(profile.sourceAttemptId, "source");
    assert.match(String(profile.consumerAttemptId), /^[0-9a-f-]{36}$/);
    assert.equal(detachedBootstrap, 1);

    onMessage({
      type: "control",
      payload: { id: "command", type: "keyboard" },
    });
    assert.equal(dispatchedControls, 1);
    assert.ok(mediaSink);
    mediaSink.close(
      scrcpyVideoConfigurationChangedCloseCode,
      "UPSTREAM_SENSITIVE_DETAIL",
    );
    finishMedia();
    await Promise.resolve();
    assert.equal(closed, 0, "allow time to deliver the notice over SCTP");
    assert.deepEqual(replies.at(-1), {
      type: "webrtc-codec-changed",
      consumerAttemptId: profile.consumerAttemptId,
    });
    onMessage({ type: "control", payload: { id: "stale", type: "keyboard" } });
    onMessage({ type: "video-resync-request" });
    assert.equal(dispatchedControls, 1);
    assert.equal(resetRequests, 0);
    // No browser response. The sidecar must still retire the peer promptly.
    const deadline = setTimeout(() => {}, 1_000);
    try {
      await bridgeClosed;
    } finally {
      clearTimeout(deadline);
    }
    onMessage({ type: "state", state: "connected" });
    onMessage({ type: "video-resync-request" });
    onMessage({ type: "control", payload: { id: "late", type: "keyboard" } });
    rejectControl(new Error("late reply"));
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(attached, 1);
    assert.equal(detachedMedia, 1);
    assert.equal(closed, 1);
    assert.equal(finished, 1);
    const terminalLogs = debug.mock.calls.flatMap(({ arguments: args }) =>
      args.filter(
        (message) =>
          typeof message === "string" && message.includes("attempt ended"),
      ),
    );
    assert.deepEqual(terminalLogs, [
      `[webrtc:session:${response.consumerAttemptId}] attempt ended reason=source_codec_changed sourceAttemptId=source`,
    ]);
    assert.equal(dispatchedControls, 1);
    assert.equal(resetRequests, 0);
    assert.equal(
      replies.some(
        (reply) => reply && typeof reply === "object" && "id" in reply,
      ),
      false,
    );
  } finally {
    attempt.stop();
  }
});

test("a connected peer accepts the reset IDR after 2.85 seconds", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 10_000 });
  const watchdog = new ScrcpyVideoResetWatchdog();
  const expired = t.mock.fn();
  const source = new ScrcpySourceStream(
    () => undefined,
    () => undefined,
    () => {
      watchdog.beginDispatch();
      watchdog.confirmDispatch(expired);
      assert.ok(watchdog.deadlineMs);
      source.setVideoReset({ generation: 1, deadlineMs: watchdog.deadlineMs });
      return true;
    },
  );
  const writeVideo = (
    timestampUs: bigint,
    kind: "config" | "idr" | "delta",
  ) => {
    const packet = {
      timestampUs,
      config: kind === "config",
      keyFrame: kind === "idr",
      data: Buffer.from(
        kind === "config"
          ? "000000016742c032da0280b7fe5c050505020000000168ce06e2"
          : kind === "idr"
            ? "00000001658884"
            : "00000001418884",
        "hex",
      ),
    };
    if (watchdog.observe(packet)) source.setVideoReset();
    source.writeVideo(packet);
  };
  writeVideo(0n, "config");
  writeVideo(1n, "idr");
  // Keep the configuration available for SDP, with a GOP too old to replay.
  writeVideo(100_000n, "delta");

  let receive!: (message: WebrtcBridgeMessage) => void;
  let open = true;
  const closeListeners: Array<() => void> = [];
  const sentMedia: Buffer[] = [];
  const sendDataChannel = t.mock.fn<(message: unknown) => void>();
  const bridge: WebrtcBridge = {
    isOpen: () => open,
    onClose: (listener) => closeListeners.push(listener),
    listen: ({ onMessage }) => {
      receive = onMessage;
    },
    sendOffer: () => receive({ type: "answer", sdp: "answer" }),
    sendDataChannel,
    writeVideo: async (payload) => {
      sentMedia.push(payload);
    },
    writeAudio: async () => undefined,
    stopAudio: () => undefined,
    close: () => {
      if (!open) return;
      open = false;
      closeListeners.forEach((listener) => listener());
    },
  };
  const attempt = new DisplayWebrtcAttempt({
    sessionId: "display",
    sdp: [
      "m=video 9 UDP/TLS/RTP/SAVPF 96",
      "a=rtpmap:96 H264/90000",
      "a=fmtp:96 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
    ].join("\r\n"),
    iceHost: "localhost",
    maxFps: 60,
    audio: false,
    allowClipboard: false,
    iceServers: [],
    attachSource: (sink) => source.attach(sink, { mode: "bootstrap" }),
    launchBridge: () => bridge,
    executeControl: () => {
      throw new Error("Unexpected control command");
    },
    onFinish: () => undefined,
  });

  try {
    await attempt.run();
    receive({ type: "state", state: "connected" });
    const resetNotice = sendDataChannel.mock.calls
      .flatMap((call) => call.arguments)
      .find(
        (message) =>
          message &&
          typeof message === "object" &&
          "type" in message &&
          message.type === "webrtc-video-reset",
      );
    assert.deepEqual(resetNotice, {
      type: "webrtc-video-reset",
      deadlineMs: 13_000,
    });

    t.mock.timers.tick(50);
    writeVideo(250_000n, "delta");
    t.mock.timers.tick(2_750);
    writeVideo(3_000_000n, "delta");
    assert.equal(open, true, "the recovery watchdog still has time");
    assert.equal(sentMedia.length, 0, "deltas wait for the IDR");

    t.mock.timers.tick(50);
    writeVideo(3_050_000n, "config");
    writeVideo(3_050_000n, "idr");
    await new Promise<void>((resolve) => setImmediate(resolve));
    t.mock.timers.tick(50);
    writeVideo(3_100_000n, "delta");
    assert.equal(open, true);
    assert.deepEqual(
      sentMedia.map((frame) => frame.readUInt16BE(6)),
      [5, 6, 0],
    );
    t.mock.timers.tick(100);
    assert.equal(expired.mock.callCount(), 0);
  } finally {
    attempt.stop();
    source.close();
    watchdog.clear();
  }
});

test("a connected peer recovers from live queue overflow without RTCP feedback", async (t) => {
  for (const sameBatchIdr of [false, true]) {
    await t.test(
      sameBatchIdr
        ? "same-batch IDR skips reset"
        : "missing IDR requests one reset",
      async (t) => {
        const requestReset = t.mock.fn(() => {
          source.setVideoReset({
            generation: 1,
            deadlineMs: Date.now() + 3_000,
          });
          return true;
        });
        const source = new ScrcpySourceStream(
          () => undefined,
          () => undefined,
          requestReset,
        );
        const writeVideo = (
          timestampUs: bigint,
          kind: "config" | "idr" | "delta",
        ) => {
          source.writeVideo({
            timestampUs,
            config: kind === "config",
            keyFrame: kind === "idr",
            data: Buffer.from(
              kind === "config"
                ? "000000016742c032da0280b7fe5c050505020000000168ce06e2"
                : kind === "idr"
                  ? "00000001658884"
                  : "00000001418884",
              "hex",
            ),
          });
        };
        writeVideo(0n, "config");
        writeVideo(1_000n, "idr");
        const siblingSink = new ScrcpyBootstrapSink();
        const siblingVideo = t.mock.method(siblingSink, "writeVideo");
        source.attach(siblingSink);

        let receive!: (message: WebrtcBridgeMessage) => void;
        let open = true;
        const closeListeners: Array<() => void> = [];
        const sentFlags: number[] = [];
        const videoResets: Array<ScrcpyVideoReset | undefined> = [];
        let blocked: Promise<void> | undefined;
        let releaseWrite: (() => void) | undefined;
        const bridge: WebrtcBridge = {
          isOpen: () => open,
          onClose: (listener) => closeListeners.push(listener),
          listen: ({ onMessage }) => {
            receive = onMessage;
          },
          sendOffer: () => receive({ type: "answer", sdp: "answer" }),
          sendDataChannel: () => undefined,
          writeVideo: async (payload, reset) => {
            sentFlags.push(payload.readUInt16BE(6));
            videoResets.push(reset);
            await blocked;
          },
          writeAudio: async () => undefined,
          stopAudio: () => undefined,
          close: () => {
            if (!open) return;
            open = false;
            closeListeners.forEach((listener) => listener());
          },
        };
        const attempt = new DisplayWebrtcAttempt({
          sessionId: "display",
          sdp: [
            "m=video 9 UDP/TLS/RTP/SAVPF 96",
            "a=rtpmap:96 H264/90000",
            "a=fmtp:96 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
          ].join("\r\n"),
          iceHost: "localhost",
          maxFps: 60,
          audio: false,
          allowClipboard: false,
          iceServers: [],
          attachSource: (sink) => source.attach(sink, { mode: "bootstrap" }),
          launchBridge: () => bridge,
          executeControl: () => {
            throw new Error("Unexpected control command");
          },
          onFinish: () => undefined,
        });

        try {
          await attempt.run();
          receive({ type: "state", state: "connected" });
          await new Promise<void>((resolve) => setImmediate(resolve));
          assert.deepEqual(sentFlags, [5, 6]);
          blocked = new Promise<void>((resolve) => {
            releaseWrite = resolve;
          });
          for (let step = 1n; step <= 12n; step++) {
            writeVideo(1_000n + step * 16_667n, "delta");
          }
          if (sameBatchIdr) writeVideo(220_000n, "idr");
          await Promise.resolve();
          assert.equal(requestReset.mock.callCount(), sameBatchIdr ? 0 : 1);
          if (!sameBatchIdr) {
            writeVideo(2_000_000n, "delta");
            assert.equal(
              open,
              true,
              "the reset deadline keeps the peer attached",
            );
            writeVideo(2_010_000n, "config");
            writeVideo(2_010_000n, "idr");
            source.setVideoReset();
          }
          const nextDelta = sameBatchIdr ? 237_000n : 2_027_000n;
          writeVideo(nextDelta, "delta");
          releaseWrite?.();
          blocked = undefined;
          await new Promise<void>((resolve) => setImmediate(resolve));

          assert.deepEqual(sentFlags, [5, 6, 0, 5, 6, 0]);
          assert.deepEqual(
            videoResets.map((reset) => reset?.generation),
            sameBatchIdr
              ? [
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                ]
              : [undefined, undefined, undefined, 1, 1, undefined],
          );
          assert.equal(open, true);
          assert.equal(source.consumerCount(), 2);
          assert.equal(
            siblingVideo.mock.calls.at(-1)?.arguments[0].timestampUs,
            nextDelta,
          );
        } finally {
          releaseWrite?.();
          attempt.stop();
          source.close();
        }
      },
    );
  }
});
