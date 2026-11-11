import assert from "node:assert/strict";
import test from "node:test";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AdbService } from "../adb/adb.service";
import { ScrcpyService } from "../scrcpy/scrcpy.service";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { SidecarFeatureService } from "../shared/sidecar-feature.service";
import { DisplayControlService } from "./display-control.service";
import { DisplaySessionService } from "./display-session.service";
import { DisplayWebrtcService } from "./display-webrtc.service";
import { DisplayController } from "./display.controller";

const secret = "session-admin-test-secret";
const headers = { "x-rebroid-sidecar-secret": secret };
const root = "/rebroid/display/sessions";

@Module({
  controllers: [DisplayController],
  providers: [
    DisplaySessionService,
    SidecarFeatureService,
    {
      provide: SidecarConfigService,
      useValue: {
        hasSharedSecret: true,
        sharedSecret: secret,
        sessionTtlSeconds: 900,
        sessionMaxLifetimeSeconds: 3600,
        sessionMaxActive: 8,
      },
    },
    ...[
      AdbService,
      ScrcpyService,
      DisplayWebrtcService,
      DisplayControlService,
    ].map((provide) => ({
      provide,
      useValue: {},
    })),
  ],
})
class DisplaySessionAdminTestModule {}

test("owner revocation closes matching main and virtual sessions and keeps inventory free of viewer grants", async () => {
  const app = await NestFactory.create<NestFastifyApplication>(
    DisplaySessionAdminTestModule,
    new FastifyAdapter(),
    { logger: false, abortOnError: false },
  );
  try {
    await app.init();
    const sessions = app.get(DisplaySessionService);
    const create = (
      ownerUserId?: string,
      surfaceKind: "main" | "virtual" = "main",
    ) =>
      sessions.create({
        appId: "test-app",
        udid: "test-target:5555",
        ownerUserId,
        surfaceKind,
        surfaceId: surfaceKind,
      });
    const main = create("selected");
    const virtual = create("selected", "virtual");
    const foreign = create("foreign");
    const ownerless = create();
    const closed: string[] = [];
    sessions.onClosed((id) => closed.push(id));

    const inventory = await app.inject({
      method: "GET",
      url: root + "/inventory",
      headers,
    });
    assert.equal(inventory.statusCode, 200);
    const { items } = inventory.json<{ items: Record<string, unknown>[] }>();
    assert.equal(items.length, 4);
    assert.equal(
      items.find((item) => item.id === main.id)?.ownerUserId,
      "selected",
    );
    for (const item of items) {
      assert.equal(
        "udid" in item || "viewerPath" in item || "streamPath" in item,
        false,
      );
    }

    const revoke = (ownerUserIds: string[], authorized = true) =>
      app.inject({
        method: "POST",
        url: root + "/revoke",
        headers: authorized ? headers : {},
        payload: { ownerUserIds },
      });
    assert.equal((await revoke(["selected"], false)).statusCode, 401);
    assert.equal((await revoke([""])).statusCode, 400);
    assert.deepEqual(closed, []);
    const first = await revoke(["selected", "selected"]);
    assert.equal(first.statusCode, 200);
    assert.deepEqual(first.json(), { released: 2 });
    assert.deepEqual(new Set(closed), new Set([main.id, virtual.id]));
    assert.deepEqual(
      sessions.list().map((session) => session.id),
      [foreign.id, ownerless.id],
    );
    assert.deepEqual((await revoke(["selected"])).json(), { released: 0 });
  } finally {
    await app.close();
  }
});
