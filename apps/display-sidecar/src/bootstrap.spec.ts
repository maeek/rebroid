import assert from "node:assert/strict";
import test from "node:test";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { WsAdapter } from "@nestjs/platform-ws";
import { AppModule } from "./modules/app.module";

test("development bootstrap serves Swagger assets and keeps internal APIs authenticated", async () => {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { logger: false },
  );
  app.useWebSocketAdapter(new WsAdapter(app));
  try {
    SwaggerModule.setup(
      "docs",
      app,
      SwaggerModule.createDocument(app, new DocumentBuilder().build()),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    for (const url of [
      "/docs",
      "/docs/swagger-ui-bundle.js",
      "/docs-json",
      "/rebroid/display/health",
    ]) {
      assert.equal(
        (await app.inject({ method: "GET", url })).statusCode,
        200,
        url,
      );
    }
    for (const url of [
      "/rebroid/display/sessions",
      "/rebroid/adb/test/clipboard",
    ]) {
      assert.equal(
        (await app.inject({ method: "GET", url })).statusCode,
        401,
        url,
      );
    }
    assert.equal(
      (await app.inject({ method: "GET", url: "/docs/../../package.json" }))
        .statusCode,
      404,
    );
  } finally {
    await app.close();
  }
});
