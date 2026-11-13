import { BadRequestException, ValidationPipe, type Type } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyHelmet from '@fastify/helmet';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { PinoNestLogger } from './pino-nest-logger';

type LogDestination = { write(message: string): void };

const redactedLogPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-orchestrator-secret"]',
  'req.headers["x-rebroid-sidecar-secret"]',
  'res.headers["set-cookie"]',
];

class HttpValidationPipe extends ValidationPipe {
  override createExceptionFactory() {
    const defaultFactory = super.createExceptionFactory();
    return (errors: ValidationError[] = []) => {
      const exception = defaultFactory(errors) as BadRequestException;
      return new BadRequestException({
        ...(exception.getResponse() as object),
        fields: errors.map(({ property }) => property),
      });
    };
  }
}

export const shouldDisableResponseCache = (url: string) => {
  const path = url.split('?')[0] ?? url;
  return (
    path === '/api/v1' ||
    path.startsWith('/api/v1/') ||
    path === '/health/live' ||
    path === '/health/ready'
  );
};

export const createFastifyAdapter = (stream?: LogDestination) =>
  new FastifyAdapter({
    genReqId: (request: IncomingMessage) => {
      const requestId = request.headers['x-request-id'];
      return typeof requestId === 'string' ? requestId : randomUUID();
    },
    logger: {
      stream,
      serializers: {
        req: (request: { method: string; url: string }) => ({
          method: request.method,
          url: request.url.split('?')[0],
        }),
      },
      redact: {
        paths: redactedLogPaths,
        censor: '[redacted]',
      },
    },
  });

export const createOrchestratorApplication = (
  module: Type<unknown>,
  stream?: LogDestination,
) => {
  const adapter = createFastifyAdapter(stream);
  return NestFactory.create<NestFastifyApplication>(module, adapter, {
    logger: new PinoNestLogger(adapter.getInstance().log),
  });
};

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
    new HttpValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
};
