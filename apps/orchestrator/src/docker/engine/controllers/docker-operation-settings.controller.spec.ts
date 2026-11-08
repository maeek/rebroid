import { Test } from '@nestjs/testing';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DockerOperationSettingsController } from './docker-operation-settings.controller';
import { DockerOperationSettingsService } from '../services/docker-operation-settings.service';

it('documents validated limits and rejects invalid updates before applying them', async () => {
  const settings = {
    getLimits: jest.fn(),
    updateLimits: jest.fn((value) => value),
  };
  const module = await Test.createTestingModule({
    controllers: [DockerOperationSettingsController],
    providers: [
      { provide: DockerOperationSettingsService, useValue: settings },
    ],
  }).compile();
  const app = module.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const generated = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().build(),
  );
  const committed = JSON.parse(
    readFileSync(
      resolve(
        __dirname,
        '../../../../../../packages/orchestrator-contracts/openapi.json',
      ),
      'utf8',
    ),
  );
  expect(committed.paths['/api/v1/platform/docker/operation-limits']).toEqual(
    generated.paths['/api/v1/platform/docker/operation-limits'],
  );
  expect(committed.components.schemas.DockerOperationLimitsDto).toEqual(
    generated.components?.schemas?.DockerOperationLimitsDto,
  );
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  try {
    const payload = {
      maxConcurrentReads: 8,
      maxConcurrentLongOperations: 4,
      slowRequestWarningMs: 5000,
      longOperationTimeoutMs: 1_800_000,
    };
    const valid = await app.inject({
      method: 'PUT',
      url: '/api/v1/platform/docker/operation-limits',
      payload,
    });
    expect(valid.statusCode).toBe(200);
    const invalid = await app.inject({
      method: 'PUT',
      url: '/api/v1/platform/docker/operation-limits',
      payload: { ...payload, maxConcurrentReads: 0 },
    });
    expect(invalid.statusCode).toBe(400);
    expect(settings.updateLimits).toHaveBeenCalledTimes(1);
  } finally {
    await app.close();
  }
});
