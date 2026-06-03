import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import {
  configureFastifyPlatform,
  createFastifyAdapter,
} from './platform/http-platform';
import { secretHeaderName } from './security/shared-secret.guard';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    createFastifyAdapter(),
  );
  const config = app.get(ConfigService);
  await configureFastifyPlatform(app);

  if (!config.get<string>('app.sharedSecret')) {
    throw new Error(
      'The orchestrator API needs a shared secret. The Docker entrypoint creates one automatically; bare local runs should set ORCHESTRATOR_SHARED_SECRET.',
    );
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Rebroid Orchestrator')
    .setDescription('Internal API for isolated app container orchestration.')
    .setVersion('0.1.0')
    .addTag('android-applications')
    .addTag('apks')
    .addTag('container-images')
    .addTag('docker-maintenance')
    .addTag('system-resources')
    .addTag('settings')
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

  const port = config.getOrThrow<number>('app.port');
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
