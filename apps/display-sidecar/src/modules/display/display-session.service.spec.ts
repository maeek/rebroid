import assert from "node:assert/strict";
import test from "node:test";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { DisplaySessionService } from "./display-session.service";

const createService = () =>
  new DisplaySessionService({
    sessionTtlSeconds: 900,
    sessionMaxLifetimeSeconds: 3600,
  } as SidecarConfigService);

test("display sessions default to canonical capability labels", () => {
  const service = createService();
  const session = service.create({ udid: "127.0.0.1:5555" });

  assert.deepEqual(session.capabilities, [
    "video",
    "audio",
    "control",
    "clipboard",
    "files",
    "screenshot",
    "diagnostics",
  ]);
});

test("display sessions normalize legacy capability aliases", () => {
  const service = createService();
  const session = service.create({
    udid: "127.0.0.1:5555",
    capabilities: ["stream", "input", "clipboard", "stream"],
  });

  assert.deepEqual(session.capabilities, ["video", "control", "clipboard"]);
  assert.doesNotThrow(() =>
    service.assertCapability(service.get(session.id), "video"),
  );
  assert.doesNotThrow(() =>
    service.assertCapability(service.get(session.id), "control"),
  );
});
