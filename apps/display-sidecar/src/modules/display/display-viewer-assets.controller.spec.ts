import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import type { FastifyReply } from "fastify";
import { DisplayViewerAssetsController } from "./display-viewer-assets.controller";

test("serves the viewer document with its anti-framing policy", async () => {
  const headers = new Map<string, string>();
  let payload: unknown;
  const response = {
    header(name: string, value: string) {
      headers.set(name, value);
      return this;
    },
    type() {
      return this;
    },
    send(value: unknown) {
      payload = value;
      return this;
    },
  } as unknown as FastifyReply;

  await new DisplayViewerAssetsController().viewer(response);

  assert.equal(
    headers.get("Content-Security-Policy"),
    "frame-ancestors 'self'; object-src 'none'; base-uri 'none'",
  );
  if (payload instanceof Readable) {
    payload.destroy();
  }
});
