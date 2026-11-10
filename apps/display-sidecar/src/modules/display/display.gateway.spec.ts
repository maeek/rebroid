import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import test from "node:test";
import { WebSocket } from "ws";
import type { ScrcpyStreamOptions } from "../scrcpy/scrcpy.types";
import { DisplayGateway } from "./display.gateway";

test("WebSocket streaming uses the interactive profile when options are omitted", async () => {
  const attached: ScrcpyStreamOptions[] = [];
  const gateway = new DisplayGateway(
    {
      assertStreamToken: () => ({ udid: "fixture" }),
      assertCapability: () => undefined,
    } as never,
    {
      attachStream: (options: ScrcpyStreamOptions) => {
        attached.push(options);
        return { closed: Promise.resolve(), detach: () => undefined };
      },
    } as never,
  );
  const client = {
    readyState: WebSocket.OPEN,
    on: () => undefined,
    close: () => undefined,
  } as unknown as WebSocket;
  await gateway.handleConnection(client, {
    url: "/rebroid/display/stream?sessionId=fixture&token=fixture",
  } as IncomingMessage);

  assert.equal(attached.length, 1);
  const { maxSize, maxFps, bitrate, iFrameInterval } = attached[0]!;
  assert.deepEqual(
    { maxSize, maxFps, bitrate, iFrameInterval },
    { maxSize: 0, maxFps: 60, bitrate: 16_000_000, iFrameInterval: 1 },
  );
});
