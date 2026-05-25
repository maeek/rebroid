import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './modules/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Rebroid Display Sidecar API')
    .setDescription(
      'Standalone ADB display, control, and browser streaming sidecar API. WebSocket endpoints are documented in the extraction guide.',
    )
    .setVersion('0.1.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-rebroid-sidecar-secret',
        in: 'header',
        description: 'Required when sidecar shared-secret auth is configured.',
      },
      'sidecar-secret',
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    jsonDocumentUrl: 'docs/openapi.json',
    yamlDocumentUrl: 'docs/openapi.yaml',
  });

  const port = Number(process.env.PORT ?? 8000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
