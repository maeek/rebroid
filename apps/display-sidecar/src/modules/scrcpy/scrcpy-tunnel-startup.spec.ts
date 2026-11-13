import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import {
  createConnection,
  createServer,
  Socket,
  type AddressInfo,
} from "node:net";
import test from "node:test";
import type { ScrcpyPacket } from "./scrcpy-packet-parser";
import { ScrcpySourceStream } from "./scrcpy-source-stream";
import { ScrcpyVideoResetWatchdog } from "./scrcpy-video-reset-watchdog";
import { ScrcpyService } from "./scrcpy.service";
import { parseCompatibilityProbe } from "./scrcpy-compatibility";

const scrcpy = new ScrcpyService({} as never, {} as never);

test("Android 13–16 pass display admission while newer SDKs remain gated", () => {
  for (const sdk of [33, 34, 35, 36]) {
    assert.doesNotThrow(() =>
      scrcpy["assertSupportedAndroidVersion"](
        parseCompatibilityProbe(`== props ==\nro.build.version.sdk=${sdk}`, ""),
      ),
    );
  }
  assert.doesNotThrow(() => scrcpy["assertSupportedAndroidVersion"](null));
  assert.throws(
    () =>
      scrcpy["assertSupportedAndroidVersion"](
        parseCompatibilityProbe(
          "== props ==\nro.build.version.sdk=37\nro.build.version.release=17",
          "",
        ),
      ),
    /Android 17 is not supported/,
  );
});

test(
  "forward tunnel preserves split codec bytes during auxiliary startup",
  { timeout: 3_000 },
  async (t) => {
    const server = createServer();
    server.listen(0, "127.0.0.1");
    t.after(() => server.close());
    await once(server, "listening");
    const accepted = once(server, "connection");
    const handshake = scrcpy["connectToForwardedVideoSocket"](
      (server.address() as AddressInfo).port,
    );
    const [device] = await accepted;
    t.after(() => device.destroy());
    device.write(Buffer.from([0, 0x68]));
    const { socket, initialPayload } = await handshake;
    t.after(() => socket.destroy());
    assert.ok(socket instanceof Socket);
    assert.equal(socket.readableFlowing, false);
    // Observe bytes buffered at the receiver before handing it to the parser.
    const buffered = once(socket, "readable");
    device.end("264");
    await buffered;
    assert.ok(socket.readableLength > 0);
    const chunks = [initialPayload];
    const ended = new Promise<void>((resolve) => socket.once("end", resolve));
    socket.on("data", (chunk: Buffer) => chunks.push(chunk));
    socket.resume();
    await ended;
    assert.equal(Buffer.concat(chunks).toString(), "h264");
  },
);

test(
  "reverse startup acquires video, audio, and control before removing the tunnel and reading media",
  { timeout: 5_000 },
  async (t) => {
    const steps: string[] = [];
    const deviceSockets: Socket[] = [];
    const acceptedSockets: Socket[] = [];
    const events = new EventEmitter();
    let port = 0;
    let allowRemoval!: () => void;
    const removal = new Promise<void>((resolve) => {
      allowRemoval = resolve;
    });
    const child = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      kill: () => {
        steps.push("kill");
      },
    });
    const service = new ScrcpyService(
      {
        ensureConnected: async () => {
          steps.push("connect ADB");
        },
        pushFile: async () => {
          steps.push("push server");
        },
        reverse: async (_udid: string, _remote: string, local: string) => {
          steps.push("adb reverse");
          port = Number(local.slice(4));
        },
        spawnAdb: () => {
          steps.push("launch");
          void (async () => {
            for (const payload of [
              Buffer.from("68323634200000000000002a0000000165", "hex"),
              Buffer.from("opus"),
              Buffer.alloc(0),
            ]) {
              const socket = createConnection(port, "127.0.0.1");
              deviceSockets.push(socket);
              await once(socket, "connect");
              socket.write(payload);
            }
          })().catch((error) => events.emit("error", error));
          return child;
        },
        removeReverse: () => {
          steps.push("remove reverse");
          events.emit("remove");
          return removal;
        },
      } as never,
      {
        scrcpyVersion: "5.0.1",
        scrcpyControlChannel: true,
      } as never,
    );
    const createAcceptor = service["createReverseSocketAcceptor"].bind(service);
    service["createReverseSocketAcceptor"] = async () => {
      const acceptor = await createAcceptor();
      steps.push("listen");
      return {
        ...acceptor,
        acceptSocket: async (timeoutMs) => {
          const socket = await acceptor.acceptSocket(timeoutMs);
          steps.push(["video", "audio", "control"][acceptedSockets.length]!);
          acceptedSockets.push(socket);
          return socket;
        },
        stopAccepting: () => {
          if (!steps.includes("stop accepting")) steps.push("stop accepting");
          acceptor.stopAccepting();
        },
        close: async () => {
          assert.ok(acceptedSockets.every((socket) => socket.destroyed));
          await acceptor.close();
          steps.push("drained");
        },
      };
    };
    const stream = new ScrcpySourceStream(
      () => undefined,
      () => undefined,
      () => true,
    );
    t.mock.method(
      stream,
      "writeVideo",
      (packet: ScrcpyPacket, done?: (error?: Error) => void) => {
        steps.push("read video");
        events.emit("frame", packet);
        done?.();
      },
    );
    service["sources"].set("display", {
      profileKey: "fixture",
      stream,
      compatibility: Promise.resolve(null),
      idleTimer: null,
      resetTimer: null,
      resetWatchdog: new ScrcpyVideoResetWatchdog(),
      resetPending: false,
      resetReason: "",
      resetGeneration: 0,
      resetCount: 0,
      lastResetAt: 0,
      resetStartedAt: 0,
    });
    let stop: (() => Promise<void>) | undefined;
    t.after(async () => {
      allowRemoval();
      await stop?.();
      for (const socket of [...deviceSockets, ...acceptedSockets])
        socket.destroy();
    });
    const removing = once(events, "remove");
    const frame = once(events, "frame");
    void frame.catch(() => undefined);
    const attempt = service["streamRawVideoAttemptWithTunnel"](
      {
        sessionId: "display",
        udid: "fixture",
        sink: stream,
        codec: "h264",
        audio: true,
        maxSize: 1080,
        maxFps: 60,
        bitrate: 8_000_000,
      },
      (cleanup) => {
        stop = cleanup;
      },
      "reverse",
    );
    void attempt.catch((error) => events.emit("error", error));
    await removing;
    assert.deepEqual(steps, [
      "connect ADB",
      "push server",
      "listen",
      "adb reverse",
      "launch",
      "video",
      "audio",
      "control",
      "remove reverse",
    ]);
    allowRemoval();
    assert.deepEqual((await frame)[0].data, Buffer.from([0x65]));
    assert.ok(stop);
    await stop();
    await attempt;
    assert.deepEqual(steps.slice(-4), [
      "stop accepting",
      "read video",
      "kill",
      "drained",
    ]);
  },
);

test(
  "reverse tunnel stops accepting while handed-off video remains readable",
  { timeout: 3_000 },
  async (t) => {
    const acceptor = await scrcpy["createReverseSocketAcceptor"]();
    const sockets: Socket[] = [];
    t.after(async () => {
      for (const socket of sockets) socket.destroy();
      await acceptor.close();
    });
    const handedOff = [];
    for (const payload of ["h264", "opus", "control"]) {
      const device = createConnection(acceptor.port, "127.0.0.1");
      sockets.push(device);
      const socket = await acceptor.acceptSocket(1_000);
      sockets.push(socket);
      handedOff.push({ device, socket, payload });
    }

    const pending = assert.rejects(
      acceptor.acceptSocket(1_000),
      /acceptor closed/,
    );
    acceptor.stopAccepting();
    await pending;
    for (const { device, socket, payload } of handedOff) {
      const data = once(socket, "data");
      device.write(payload);
      assert.equal(String((await data)[0]), payload);
    }
    const extra = createConnection(acceptor.port, "127.0.0.1");
    sockets.push(extra);
    assert.equal((await once(extra, "error"))[0].code, "ECONNREFUSED");
    for (const socket of sockets) socket.destroy();
    await acceptor.close();
  },
);
