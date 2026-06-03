import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyHelmet from '@fastify/helmet';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

const redactedLogPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-orchestrator-secret"]',
  'req.headers["x-rebroid-sidecar-secret"]',
  'res.headers["set-cookie"]',
];

export const shouldDisableResponseCache = (url: string) => {
  const path = url.split('?')[0] ?? url;
  return (
    path === '/api/v1' ||
    path.startsWith('/api/v1/') ||
    path === '/health/live' ||
    path === '/health/ready'
  );
};

export const createFastifyAdapter = () =>
  new FastifyAdapter({
    genReqId: (request: IncomingMessage) => {
      const requestId = request.headers['x-request-id'];
      return typeof requestId === 'string' ? requestId : randomUUID();
    },
    logger: {
      redact: {
        paths: redactedLogPaths,
        censor: '[redacted]',
      },
    },
  });

export const configureFastifyPlatform = async (app: NestFastifyApplication) => {
  const config = app.get(ConfigService);
  const fastify = app.getHttpAdapter().getInstance();

  await app.register(fastifyHelmet);
  fastify.addContentTypeParser(
    /^multipart\/form-data(?:;.*)?$/i,
    (_request, payload, done) => {
      done(null, payload);
    },
  );
  fastify.addHook('onRequest', (request, reply, done) => {
    reply.header('x-request-id', request.id);
    if (shouldDisableResponseCache(request.url)) {
      reply.header('cache-control', 'no-store');
    }
    done();
  });

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
};
