import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import {
  secretHeaderName,
  SharedSecretGuard,
} from './security/shared-secret.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalGuards(app.get(SharedSecretGuard));

  if (!config.get<string>('app.sharedSecret')) {
    throw new Error(
      'ORCHESTRATOR_SHARED_SECRET must be configured for the orchestrator API.',
    );
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Shop Me Alone Orchestrator')
    .setDescription(
      'Internal API for isolated app container orchestration.',
    )
    .setVersion('0.1.0')
    .addTag('android-applications')
    .addTag('apks')
    .addTag('container-images')
    .addTag('docker-maintenance')
    .addTag('system-resources')
    .addTag('settings')
    .addTag('network-policy')
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

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = config.getOrThrow<number>('app.port');
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
