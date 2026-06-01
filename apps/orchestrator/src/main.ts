import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';
import { AppModule } from './app.module';
import {
  secretHeaderName,
  SharedSecretGuard,
} from './security/shared-secret.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.use(helmet());
  app.use(
    pinoHttp({
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-orchestrator-secret"]',
          'req.headers["x-rebroid-sidecar-secret"]',
          'res.headers["set-cookie"]',
        ],
        censor: '[redacted]',
      },
      genReqId: (request, response) => {
        const requestId =
          typeof request.headers['x-request-id'] === 'string'
            ? request.headers['x-request-id']
            : randomUUID();
        response.setHeader('x-request-id', requestId);
        return requestId;
      },
    }),
  );
  app.setGlobalPrefix('api/v1', {
    exclude: ['health/live', 'health/ready'],
  });

  const corsOrigins = config.get<string[]>('app.corsOrigins') ?? [];
  if (corsOrigins.length > 0) {
    app.enableCors({
      origin: corsOrigins,
      credentials: true,
    });
  }
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
