import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AndroidAppsLifecycleService } from '../../lifecycle/services/android-apps-lifecycle.service';
import { AndroidAppsQueryService } from '../services/android-apps-query.service';
import { AndroidAppsRuntimeStateReconciler } from '../services/android-apps-runtime-state-reconciler.service';
import { AndroidAppsController } from './android-apps.controller';

describe('application summary query', () => {
  const listSummaries = jest.fn().mockResolvedValue([]);
  let server: NestFastifyApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AndroidAppsController],
      providers: [
        { provide: AndroidAppsLifecycleService, useValue: {} },
        { provide: AndroidAppsQueryService, useValue: { listSummaries } },
        { provide: AndroidAppsRuntimeStateReconciler, useValue: {} },
      ],
    }).compile();
    server = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    server.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await server.init();
  });

  afterAll(() => server.close());

  it.each([
    ['applicationIds=one', ['one']],
    ['applicationIds=one&applicationIds=two', ['one', 'two']],
  ])('accepts bounded application IDs via %s', async (query, ids) => {
    const result = await server.inject({
      method: 'GET',
      url: `/apps/summaries?ownerUserId=owner&includeRunning=true&${query}`,
    });

    expect(result.statusCode).toBe(200);
    expect(listSummaries).toHaveBeenLastCalledWith({
      ownerUserId: 'owner',
      includeRunning: 'true',
      applicationIds: ids,
    });
  });

  it('rejects an oversized ID list before reading stored state', async () => {
    listSummaries.mockClear();
    const result = await server.inject({
      method: 'GET',
      url: '/apps/summaries?applicationIds=1&applicationIds=2&applicationIds=3&applicationIds=4&applicationIds=5&applicationIds=6',
    });

    expect(result.statusCode).toBe(400);
    expect(listSummaries).not.toHaveBeenCalled();
  });
});
