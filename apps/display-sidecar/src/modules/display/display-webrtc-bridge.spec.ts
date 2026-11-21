import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import test from "node:test";
import {
  encodeRebroidMediaFrame,
  videoMediaFrame,
} from "../scrcpy/scrcpy-media-frame";
import { connectWebrtcBridge } from "./display-webrtc-bridge";
import type { WebrtcBridge } from "./display-webrtc-bridge";

test(
  "the private video socket orders reset metadata with unchanged RBD1 frames",
  { timeout: 5_000 },
  async (t) => {
    const directory = await mkdtemp("/tmp/rbd-video-");
    const path = join(directory, "bridge.sock");
    const frame = encodeRebroidMediaFrame(
      videoMediaFrame(
        {
          data: Buffer.from([0, 0, 0, 1, 0x65]),
          timestampUs: 1n,
          config: false,
          keyFrame: true,
        },
        1,
      ),
    );
    const fixture = await readFile(
      join(__dirname, "../../../webrtc-bridge/testdata/rbr1-video-reset.hex"),
      "utf8",
    );
    const [reset, clear] = fixture.trim().split(/\s+/);
    assert.ok(reset && clear);
    const expected = Buffer.concat([
      frame,
      Buffer.from(reset, "hex"),
      frame,
      frame,
      Buffer.from(clear, "hex"),
      frame,
    ]);
    let bridge: WebrtcBridge | undefined;
    const server = createServer();
    t.after(async () => {
      bridge?.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(directory, { recursive: true, force: true });
    });
    const received = new Promise<Buffer>((resolve) => {
      server.on("connection", (socket) => {
        let input = Buffer.alloc(0);
        socket.on("data", (chunk) => {
          input = Buffer.concat([input, chunk]);
          if (input[16] === 1 && input.length >= expected.length + 17) {
            resolve(input.subarray(17));
          }
        });
      });
    });
    server.listen(path);
    await once(server, "listening");
    bridge = connectWebrtcBridge(path, "00000000-0000-0000-0000-000000000001");
    const allowance = { generation: 3, deadlineMs: 13_000 };
    await bridge.writeVideo(frame);
    await bridge.writeVideo(frame, allowance);
    await bridge.writeVideo(frame, allowance);
    await bridge.writeVideo(frame);
    assert.deepEqual(await received, expected);
  },
);
