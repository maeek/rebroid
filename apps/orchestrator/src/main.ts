import { ConfigService } from '@nestjs/config';
import websocket from '@fastify/websocket';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AutomationRunEventStreamService } from './automations/events/automation-run-event-stream.service';
import { registerDockerTerminalWebSocket } from './docker-maintenance/containers/controllers/docker-terminal-websocket';
import { DockerTerminalAuthorizationService } from './docker-maintenance/containers/services/docker-terminal-authorization.service';
import { DockerTerminalSessionService } from './docker-maintenance/containers/services/docker-terminal-session.service';
import { terminalFrameLimit } from './docker-maintenance/containers/services/docker-terminal-stream';
import {
  configureFastifyPlatform,
  createOrchestratorApplication,
} from './platform/http-platform';
import { secretHeaderName } from './security/shared-secret.guard';

async function bootstrap() {
  const app = await createOrchestratorApplication(AppModule);
  const config = app.get(ConfigService);
  await configureFastifyPlatform(app);

  if (!config.get<string>('app.sharedSecret')) {
    throw new Error(
      'The orchestrator API needs a shared secret. The Docker entrypoint creates one automatically; bare local runs should set ORCHESTRATOR_SHARED_SECRET.',
    );
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Rebroid Orchestrator')
    .setDescription(
      'Internal API for Android devices and runtime orchestration.',
    )
    .setVersion('0.1.0')
    .addTag('devices')
    .addTag('app-lifecycle')
    .addTag('app-runtime')
    .addTag('app-viewer')
    .addTag('apk-uploads')
    .addTag('network-policies')
    .addTag('platform-docker')
    .addTag('platform-container-images')
    .addTag('platform-display-sidecar')
    .addTag('platform-system-resources')
    .addTag('settings')
    .addTag('features')
    .addTag('health')
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: secretHeaderName,
        description:
          'Shared secret required when ORCHESTRATOR_SHARED_SECRET is configured.',
      },
      'orchestrator-secret',
    )
    .addSecurityRequirements('orchestrator-secret')
    .build();

  if (config.get<boolean>('app.enableApiDocs')) {
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  const fastify = app.getHttpAdapter().getInstance();
  await fastify.register(websocket, {
    options: { maxPayload: terminalFrameLimit },
  });
  app.get(AutomationRunEventStreamService).register(fastify);
  registerDockerTerminalWebSocket(
    fastify,
    app.get(DockerTerminalAuthorizationService),
    app.get(DockerTerminalSessionService),
  );
  app.enableShutdownHooks();

  const port = config.getOrThrow<number>('app.port');
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
