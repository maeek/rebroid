import assert from "node:assert/strict";
import { NotFoundException } from "@nestjs/common";
import type { IncomingMessage } from "node:http";
import test from "node:test";
import { WebSocket } from "ws";
import type { ScrcpyStreamOptions } from "../scrcpy/scrcpy.types";
import { DisplayGateway } from "./display.gateway";

test("WebSocket streaming uses the interactive profile when options are omitted", async () => {
  const attached: ScrcpyStreamOptions[] = [];
  const gateway = new DisplayGateway(
    {
      assertCapability: () => undefined,
    } as never,
    {
      attachStream: (options: ScrcpyStreamOptions) => {
        attached.push(options);
        return { closed: Promise.resolve(), detach: () => undefined };
      },
    } as never,
    {
      admit: async () => ({
        session: { udid: "fixture", capabilities: ["video"] },
        watch: () => () => undefined,
      }),
    } as never,
  );
  const client = {
    readyState: WebSocket.OPEN,
    on: () => undefined,
    close: () => undefined,
  } as unknown as WebSocket;
  await gateway.handleConnection(client, {
    url: "/rebroid/display/stream?sessionId=fixture&audio=1",
  } as IncomingMessage);

  assert.equal(attached.length, 1);
  assert.equal(attached[0]?.audio, false);
  const { maxSize, maxFps, bitrate, iFrameInterval } = attached[0]!;
  assert.deepEqual(
    { maxSize, maxFps, bitrate, iFrameInterval },
    { maxSize: 0, maxFps: 60, bitrate: 16_000_000, iFrameInterval: 1 },
  );
});

test("WebSocket streaming distinguishes an expired session from transport failure", async () => {
  const gateway = new DisplayGateway(
    {} as never,
    {
      attachStream: () => assert.fail("attached with an expired session"),
    } as never,
    {
      admit: () => {
        throw new NotFoundException("Display session not found.");
      },
    } as never,
  );
  const closeCodes: number[] = [];
  const client = {
    readyState: WebSocket.OPEN,
    close: (code: number) => closeCodes.push(code),
  } as unknown as WebSocket;
  await gateway.handleConnection(client, {
    url: "/rebroid/display/stream?sessionId=expired",
  } as IncomingMessage);
  assert.deepEqual(closeCodes, [4404]);
});
