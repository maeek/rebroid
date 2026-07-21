import assert from "node:assert/strict";
import test from "node:test";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { DisplaySessionService } from "./display-session.service";
import { SidecarFeatureService } from "../shared/sidecar-feature.service";

const createService = (sessionMaxActive = 64) =>
  new DisplaySessionService(
    {
      sessionTtlSeconds: 900,
      sessionMaxLifetimeSeconds: 3600,
      sessionMaxActive,
    } as SidecarConfigService,
    new SidecarFeatureService(),
  );

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

test("display sessions reuse a matching live session", () => {
  const service = createService();
  const first = service.create({ udid: "127.0.0.1:5555", appId: "app-1" });
  const second = service.create({ udid: "127.0.0.1:5555", appId: "app-1" });

  assert.equal(second.id, first.id);
  assert.equal(service.list().length, 1);
});

test("released and expired sessions are purged", () => {
  const service = createService();
  const released = service.create({
    udid: "127.0.0.1:5555",
    appId: "released",
  });
  service.release(released.id);
  assert.equal(service.list().length, 0);

  const expired = service.create({ udid: "127.0.0.1:5555", appId: "expired" });
  const stored = (
    service as unknown as { sessions: Map<string, { expiresAt: string }> }
  ).sessions.get(expired.id);
  assert.ok(stored);
  stored.expiresAt = new Date(0).toISOString();
  assert.equal(service.list().length, 0);
});

test("display sessions reject new work at capacity", () => {
  const service = createService(1);
  service.create({ udid: "127.0.0.1:5555", appId: "first" });

  assert.throws(
    () => service.create({ udid: "127.0.0.1:5555", appId: "second" }),
    (error: unknown) => {
      const response = (
        error as { getResponse?: () => unknown }
      ).getResponse?.();
      return (
        typeof response === "object" &&
        response !== null &&
        (response as { code?: string }).code ===
          "display_session_capacity_exceeded"
      );
    },
  );
});

test("virtual displays require a synchronized enabled feature", () => {
  const features = new SidecarFeatureService();
  const service = new DisplaySessionService(
    {
      sessionTtlSeconds: 900,
      sessionMaxLifetimeSeconds: 3600,
      sessionMaxActive: 64,
    } as SidecarConfigService,
    features,
  );
  const main = service.create({ udid: "127.0.0.1:5555" });

  assert.throws(() => service.createVirtualSurface(main.id));
  features.apply({
    revision: 1,
    features: [{ key: "feature.display-virtual", effective: true }],
  });
  assert.equal(service.createVirtualSurface(main.id).surfaceKind, "virtual");
});

test("display sessions keep only canonical capability labels", () => {
  const service = createService();
  const session = service.create({
    udid: "127.0.0.1:5555",
    capabilities: ["video", "control", "clipboard", "video"],
  });

  assert.deepEqual(session.capabilities, ["video", "control", "clipboard"]);
  assert.doesNotThrow(() =>
    service.assertCapability(service.get(session.id), "video"),
  );
  assert.doesNotThrow(() =>
    service.assertCapability(service.get(session.id), "control"),
  );
});
