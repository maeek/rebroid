import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { DirectAdbConnection } from "./direct-adb-connection";
import type { ScrcpySocket } from "./scrcpy.types";

test(
  "direct ADB confirms a write only when it leaves the local queue",
  { timeout: 5_000 },
  async (t) => {
    const connect = 0x4e584e43;
    const open = 0x4e45504f;
    const okay = 0x59414b4f;
    const server = createServer();
    const connection = new DirectAdbConnection();
    t.after(() => {
      connection.destroy();
      server.close();
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const port = (server.address() as AddressInfo).port;
    const accepted = once(server, "connection");
    const connected = connection.connect("127.0.0.1", port);
    const [peer] = await accepted;
    t.after(() => peer.destroy());
    let localId = 0;
    let pending = Buffer.alloc(0);
    const respond = (command: number, localId = 0) => {
      const header = Buffer.alloc(24);
      header.writeUInt32LE(command);
      header.writeUInt32LE(1, 4);
      header.writeUInt32LE(localId, 8);
      peer.write(header);
    };
    peer.on("data", (chunk: Buffer) => {
      pending = Buffer.concat([pending, chunk]);
      while (pending.length >= 24) {
        const length = pending.readUInt32LE(12);
        if (pending.length < 24 + length) return;
        const command = pending.readUInt32LE(0);
        if (command === connect) respond(connect);
        if (command === open) {
          localId = pending.readUInt32LE(4);
          respond(okay, localId);
        }
        pending = pending.subarray(24 + length);
      }
    });

    await connected;
    const socket: ScrcpySocket = await connection.open(
      "localabstract:fixture",
      "control",
    );
    const send = (byte: number) =>
      new Promise<void>((resolve, reject) =>
        socket.write(Buffer.from([byte]), (error) =>
          error ? reject(error) : resolve(),
        ),
      );
    await send(1);
    let completed = false;
    const second = send(2).then(() => {
      completed = true;
    });
    await Promise.resolve();
    assert.equal(completed, false);
    respond(okay, localId);
    await second;
    const discarded = assert.rejects(send(3), /closed before writing/);
    socket.destroy();
    await discarded;
  },
);
