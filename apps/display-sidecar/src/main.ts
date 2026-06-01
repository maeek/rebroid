import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { WsAdapter } from "@nestjs/platform-ws";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "@fastify/helmet";
import { AppModule } from "./modules/app.module";
import { SidecarConfigService } from "./modules/shared/sidecar-config.service";

const fatal = (source: string, error: unknown) => {
  console.error(`[display-sidecar] ${source}:`, error);
  process.exit(1);
};

process.on("uncaughtException", (error) => {
  fatal("uncaught exception", error);
});
process.on("unhandledRejection", (error) => {
  fatal("unhandled rejection", error);
});

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true, requestIdHeader: "x-request-id" }),
    { bufferLogs: true },
  );
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableShutdownHooks();
  await app.register(helmet);

  const config = app.get(SidecarConfigService);
  if (config.enableApiDocs) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Rebroid Display Sidecar API")
      .setDescription(
        "Standalone ADB display, control, and browser streaming sidecar API. WebSocket endpoints are documented in the extraction guide.",
      )
      .setVersion("0.1.0")
      .addApiKey(
        {
          type: "apiKey",
          name: "x-rebroid-sidecar-secret",
          in: "header",
          description:
            "Required when sidecar shared-secret auth is configured.",
        },
        "sidecar-secret",
      )
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("docs", app, swaggerDocument, {
      jsonDocumentUrl: "docs/openapi.json",
      yamlDocumentUrl: "docs/openapi.yaml",
    });
  }

  const port = config.port;
  await app.listen({ port, host: "0.0.0.0" });
}

void bootstrap().catch((error) => {
  fatal("bootstrap failed", error);
});
