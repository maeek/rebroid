import assert from "node:assert/strict";
import { test } from "node:test";
import { ServiceUnavailableException } from "@nestjs/common";
import type { ExternalAdbDaemon } from "../external-adb/external-adb-daemon";
import type { SidecarConfigService } from "../shared/sidecar-config.service";
import { HealthController } from "./health.controller";

const readyBroker = {
  adb: true,
  keyStorage: true,
  usb: "unavailable",
} as const;
const controller = (
  externalAdbEnabled: boolean,
  hasSharedSecret: boolean,
  readiness: () => Promise<unknown>,
) =>
  new HealthController(
    { port: 8000, externalAdbEnabled, hasSharedSecret } as SidecarConfigService,
    { readiness } as ExternalAdbDaemon,
  );

test("managed and unconfigured sidecars skip the broker probe", async () => {
  for (const [enabled, secret] of [
    [false, true],
    [true, false],
  ]) {
    const health = controller(enabled, secret, () =>
      Promise.reject(new Error("unexpected probe")),
    );
    assert.deepEqual(await health.ready(), health.health());
  }
});

test("missing USB leaves TCP available", async () => {
  const health = controller(true, true, () => Promise.resolve(readyBroker));
  assert.deepEqual(await health.ready(), {
    ...health.health(),
    externalAdb: readyBroker,
  });
});

test("broker readiness returns sanitized diagnostics when key storage fails", async () => {
  const externalAdb = { ...readyBroker, keyStorage: false };
  const health = controller(true, true, () => Promise.resolve(externalAdb));
  await assert.rejects(health.ready(), (error) => {
    assert.ok(error instanceof ServiceUnavailableException);
    assert.deepEqual(error.getResponse(), {
      ...health.health(),
      ok: false,
      externalAdb,
    });
    return true;
  });
});
