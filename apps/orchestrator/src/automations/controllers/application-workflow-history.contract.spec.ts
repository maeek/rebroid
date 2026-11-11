import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { AutomationsService } from '../services/automations.service';
import { AutomationsController } from './automations.controller';

it('publishes and validates the app workflow history and run detail routes', async () => {
  const service = {
    listApplicationWorkflowRuns: jest
      .fn()
      .mockResolvedValue({ items: [], total: 0, pageSize: 10 }),
    getApplicationWorkflowRun: jest.fn().mockResolvedValue({ id: 'run' }),
  };
  const fixture = await Test.createTestingModule({
    controllers: [AutomationsController],
    providers: [{ provide: AutomationsService, useValue: service }],
  }).compile();
  const app = fixture.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();
  try {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    const committed = JSON.parse(
      readFileSync(
        resolve(
          __dirname,
          '../../../../../packages/orchestrator-contracts/openapi.json',
        ),
        'utf8',
      ),
    ) as OpenAPIObject;
    const path = '/api/v1/automations/runs/history';
    for (const route of [path, `${path}/{runId}`]) {
      expect(committed.paths[route]).toEqual(doc.paths[route]);
    }
    for (const name of [
      'AutomationRunDto',
      'ApplicationWorkflowRunDto',
      'ApplicationWorkflowRunRowDto',
      'ApplicationWorkflowRunPageDto',
    ]) {
      expect(committed.components?.schemas?.[name]).toEqual(
        doc.components?.schemas?.[name],
      );
    }
    const scope = 'ownerUserId=owner&targetApplicationId=app';
    const response = await app.inject({
      url: `${path}?${scope}&page=2&pageSize=10&q=inventory`,
    });
    expect(response.statusCode).toBe(200);
    expect(service.listApplicationWorkflowRuns).toHaveBeenCalledWith({
      ownerUserId: 'owner',
      targetApplicationId: 'app',
      page: 2,
      pageSize: 10,
      q: 'inventory',
    });
    expect(
      (await app.inject({ url: `${path}?${scope}&pageSize=101` })).statusCode,
    ).toBe(400);
    expect(
      (await app.inject({ url: `${path}/invalid?${scope}` })).statusCode,
    ).toBe(400);
    const runId = '76e85cb0-135b-4ca0-9782-bcb7233b4672';
    expect(
      (await app.inject({ url: `${path}/${runId}?${scope}` })).statusCode,
    ).toBe(200);
    expect(service.getApplicationWorkflowRun).toHaveBeenCalledWith(
      'owner',
      'app',
      runId,
    );
  } finally {
    await app.close();
  }
});
