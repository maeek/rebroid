// Run inside the display-sidecar image on an isolated network.
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { createConnection, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const directory = await mkdtemp(join(tmpdir(), "rebroid-adb-spike-"));
const fixtureSockets = new Set();
const listeners = [];
const deadline = AbortSignal.timeout(15_000);
let daemon;
let serverSocket;

const adb = async (...args) => {
  const { stdout } = await run("adb", ["-L", serverSocket, ...args], {
    signal: deadline,
    timeout: 3_000,
  });
  return stdout.trim();
};

async function listen(listener) {
  listeners.push(listener);
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening", { signal: deadline });
  return listener.address().port;
}

function track(socket) {
  fixtureSockets.add(socket);
  socket.on("error", () => socket.destroy());
  socket.once("close", () => fixtureSockets.delete(socket));
}

function send(socket, command, arg0, arg1, payload = "") {
  const data = Buffer.from(payload);
  const header = Buffer.alloc(24);
  header.write(command);
  header.writeUInt32LE(arg0, 4);
  header.writeUInt32LE(arg1, 8);
  header.writeUInt32LE(data.length, 12);
  header.writeUInt32LE(
    data.reduce((sum, byte) => sum + byte, 0),
    16,
  );
  header.writeUInt32LE((header.readUInt32LE(0) ^ 0xffffffff) >>> 0, 20);
  socket.write(Buffer.concat([header, data]));
}

// These peers implement only enough ADB to identify themselves and serve a
// fixed payload through a localabstract forward. They execute no commands.
async function startPeer(identity) {
  const peer = { sockets: new Set(), opens: 0 };
  peer.port = await listen(
    createServer((socket) => {
      track(socket);
      peer.sockets.add(socket);
      socket.once("close", () => peer.sockets.delete(socket));
      let pending = Buffer.alloc(0);
      socket.on("data", (chunk) => {
        pending = Buffer.concat([pending, chunk]);
        while (pending.length >= 24) {
          const length = pending.readUInt32LE(12);
          const messageEnd = 24 + length;
          if (pending.length < messageEnd) return;
          const command = pending.toString("ascii", 0, 4);
          const remote = pending.readUInt32LE(4);
          const payload = pending.toString("utf8", 24, messageEnd);
          pending = pending.subarray(messageEnd);
          if (command === "CNXN") {
            send(socket, "CNXN", 0x01000000, 4096, "device::\0");
          } else if (command === "OPEN") {
            peer.opens += 1;
            assert.equal(
              payload.replace(/\0+$/, ""),
              "localabstract:rebroid-spike",
            );
            send(socket, "OKAY", 1, remote);
            send(socket, "WRTE", 1, remote, identity);
          }
        }
      });
    }),
  );
  return peer;
}

async function forwardTo(transport) {
  const port = await adb(
    "-t",
    transport,
    "forward",
    "tcp:0",
    "localabstract:rebroid-spike",
  );
  const socket = createConnection({ host: "127.0.0.1", port: Number(port) });
  track(socket);
  const [data] = await once(socket, "data", { signal: deadline });
  socket.destroy();
  return data.toString();
}

async function transportId(port) {
  const target = `127.0.0.1:${port}`;
  while (true) {
    const devices = await adb("devices", "-l");
    const row = devices
      .split("\n")
      .find(
        (line) =>
          line.startsWith(`${target}\t`) || line.startsWith(`${target} `),
      );
    const transport = row?.match(/\sdevice\s.*\btransport_id:(\d+)/)?.[1];
    if (transport) return transport;
    await delay(50, undefined, { signal: deadline });
  }
}

async function startAdb(name) {
  const path = join(directory, name);
  serverSocket = `localfilesystem:${path}`;
  const child = spawn("adb", ["-L", serverSocket, "nodaemon", "server"], {
    stdio: "ignore",
    env: { ...process.env, ANDROID_SDK_HOME: directory },
  });
  daemon = { child, exited: once(child, "exit") };
  while (!(await stat(path).catch(() => null))?.isSocket()) {
    assert.equal(
      child.exitCode,
      null,
      "ADB server exited before binding its socket",
    );
    await delay(50, undefined, { signal: deadline });
  }
}

async function stopAdb() {
  if (!daemon) return;
  daemon.child.kill();
  await daemon.exited;
  daemon = undefined;
}

try {
  await startAdb("first.sock");
  console.log(await adb("version"));

  const first = await startPeer("first");
  const second = await startPeer("second");
  let upstream = first;
  let relayConnections = 0;
  const relayPort = await listen(
    createServer((downstream) => {
      track(downstream);
      relayConnections += 1;
      if (relayConnections > 1) {
        downstream.destroy();
        return;
      }
      const connected = createConnection(upstream.port, "127.0.0.1");
      track(connected);
      downstream.once("close", () => connected.destroy());
      connected.once("close", () => downstream.destroy());
      downstream.pipe(connected).pipe(downstream);
    }),
  );

  await adb("connect", `127.0.0.1:${relayPort}`);
  await adb("connect", `127.0.0.1:${second.port}`);
  const retiredId = await transportId(relayPort);
  const secondId = await transportId(second.port);
  assert.notEqual(retiredId, secondId);
  assert.equal(await forwardTo(retiredId), "first");
  assert.equal(await forwardTo(secondId), "second");
  console.log(
    "ADB selected two distinct transports and forwarded each peer's payload.",
  );

  upstream = second;
  for (const socket of first.sockets) socket.destroy();
  while (
    (await adb("-t", retiredId, "get-state").catch(() => "gone")) === "device"
  ) {
    await delay(50, undefined, { signal: deadline });
  }
  await adb("connect", `127.0.0.1:${relayPort}`).catch(() => {});
  assert.ok(
    relayConnections > 1,
    "Expected a second connection attempt at the same endpoint",
  );
  await assert.rejects(
    adb("-t", retiredId, "forward", "tcp:0", "localabstract:rebroid-spike"),
  );
  assert.equal(
    second.opens,
    1,
    "Replacement peer received a request through the retired relay",
  );
  assert.equal(await forwardTo(secondId), "second");
  console.log(
    "The retired relay refused reconnection and the unrelated transport kept forwarding.",
  );

  await stopAdb();
  await startAdb("second.sock");
  await adb("connect", `127.0.0.1:${second.port}`);
  const reusedId = await transportId(second.port);
  assert.equal(reusedId, retiredId);
  assert.equal(await forwardTo(reusedId), "second");
  console.log(
    "A fresh ADB server reused the retired numeric ID for a different peer.",
  );
} finally {
  for (const socket of fixtureSockets) socket.destroy();
  for (const listener of listeners) listener.close();
  await stopAdb();
  await rm(directory, { recursive: true, force: true });
}
