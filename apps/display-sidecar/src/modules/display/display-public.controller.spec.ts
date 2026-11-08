import assert from "node:assert/strict";
import test from "node:test";
import { DisplayPublicController } from "./display-public.controller";
import type { DisplayControlRequest } from "./display.types";

test("public keyboard and touch routes retain server-owned control types", async () => {
  const calls: DisplayControlRequest[] = [];
  const controller = new DisplayPublicController(
    { assertStreamToken: () => undefined } as never,
    {
      execute: async (_id: string, request: DisplayControlRequest) => {
        calls.push(request);
        return { executed: true };
      },
    } as never,
    {} as never,
  );
  await controller.keyboard("session", {
    type: "clipboard",
    text: "injected",
    key: "a",
  } as never);
  await controller.touch("session", {
    type: "clipboard",
    text: "injected",
    x: 1,
    y: 1,
  } as never);
  assert.deepEqual(
    calls.map((request) => request.type),
    ["keyboard", "touch"],
  );
});
