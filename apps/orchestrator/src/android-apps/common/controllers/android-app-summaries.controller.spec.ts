import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AndroidApplication } from '../../android-application.entity';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import { AndroidAppsLifecycleService } from '../../lifecycle/services/android-apps-lifecycle.service';
import type { AndroidApplicationsRepository } from '../../persistence/android-applications.repository';
import { AndroidAppsQueryService } from '../services/android-apps-query.service';
import { AndroidAppsRuntimeStateReconciler } from '../services/android-apps-runtime-state-reconciler.service';
import { AndroidAppsStatusService } from '../services/android-apps-status.service';
import { AndroidAppsController } from './android-apps.controller';

describe('application summary query', () => {
  const listNavigation = jest.fn().mockResolvedValue([]);
  const listSummaries = jest.fn().mockResolvedValue([]);
  const getStored = jest.fn<Promise<AndroidApplication>, [string]>();
  const findViewerRuntime = jest.fn<Promise<AndroidApplication>, [string]>();
  const create = jest.fn<Promise<AndroidApplication>, [unknown]>();
  let server: NestFastifyApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AndroidAppsController],
      providers: [
        { provide: AndroidAppsLifecycleService, useValue: { create } },
        {
          provide: AndroidAppsQueryService,
          useValue: Object.assign(
            new AndroidAppsQueryService(
              {
                findById: getStored,
                findViewerRuntime,
              } as unknown as AndroidApplicationsRepository,
              new AndroidAppsStatusService(),
            ),
            { listSummaries, listNavigation },
          ),
        },
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

  it('requires the managed kind before dispatching provisioning', async () => {
    for (const kind of [undefined, 'external', null]) {
      const result = await server.inject({
        method: 'POST',
        url: '/devices',
        payload: { name: 'Test device', kind },
      });
      expect(result.statusCode).toBe(400);
    }
    expect(create).not.toHaveBeenCalled();
    create.mockResolvedValue(
      Object.assign(new AndroidApplication(), {
        id: 'device-id',
        status: AndroidApplicationStatus.Provisioning,
        savedProfilesJson: '[]',
      }),
    );
    const accepted = await server.inject({
      method: 'POST',
      url: '/devices',
      payload: { name: 'Test device', kind: 'managed' },
    });
    expect(accepted.statusCode).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test device', kind: 'managed' }),
      undefined,
      'admin',
    );
  });

  it('projects a running viewer target from its stored record', async () => {
    const device = Object.assign(new AndroidApplication(), {
      id: 'device-id',
      ownerUserId: 'owner',
      status: AndroidApplicationStatus.Running,
      containerId: 'container-id',
    });
    findViewerRuntime.mockResolvedValue(device);
    const url = '/devices/device-id/viewer-runtime';
    const running = await server.inject({ url });
    expect(running.json()).toEqual({
      deviceId: 'device-id',
      kind: 'managed',
      ownerUserId: 'owner',
      runtimeId: 'container-id',
    });
    device.status = AndroidApplicationStatus.Stopped;
    const stopped = await server.inject({ url });
    expect(stopped.json()).toMatchObject({ runtimeId: null });
  });

  it.each([
    ['applicationIds=one', ['one']],
    ['applicationIds=one&applicationIds=two', ['one', 'two']],
  ])('accepts bounded application IDs via %s', async (query, ids) => {
    const result = await server.inject({
      method: 'GET',
      url: `/devices/summaries?ownerUserId=owner&includeRunning=true&${query}`,
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
      url: '/devices/summaries?applicationIds=1&applicationIds=2&applicationIds=3&applicationIds=4&applicationIds=5&applicationIds=6',
    });

    expect(result.statusCode).toBe(400);
    expect(listSummaries).not.toHaveBeenCalled();
  });

  it('validates the navigation projection request and returns a normal read response', async () => {
    const request = {
      applicationIds: [],
      includeRunning: true,
      runningLimit: 5,
      locale: 'en-US',
    };
    const response = await server.inject({
      method: 'POST',
      url: '/devices/navigation',
      payload: request,
    });
    expect(response.statusCode).toBe(200);
    expect(listNavigation).toHaveBeenCalledWith(request);

    listNavigation.mockClear();
    const invalid = await server.inject({
      method: 'POST',
      url: '/devices/navigation',
      payload: { ...request, runningLimit: 6 },
    });
    expect(invalid.statusCode).toBe(400);
    expect(listNavigation).not.toHaveBeenCalled();
  });

  it('returns only lifecycle state until the application configuration changes', async () => {
    const app = Object.assign(new AndroidApplication(), {
      id: 'app-id',
      name: 'Original name',
      ownerUserId: 'owner',
      status: AndroidApplicationStatus.Stopped,
      lifecycleStage: AndroidApplicationLifecycleStage.Stopped,
      savedProfilesJson: '[]',
      networkPolicyAllowCidrs: '[]',
      updatedAt: new Date('2026-11-01T00:00:00Z'),
    });
    getStored.mockResolvedValue(app);
    const initial = await server.inject({
      method: 'GET',
      url: '/devices/app-id',
    });
    expect(initial.statusCode).toBe(200);
    expect(initial.json()).toMatchObject({
      id: 'app-id',
      kind: 'managed',
      operations: expect.arrayContaining(['start', 'profiles', 'viewer']),
    });
    const { detailRevision } = initial.json<{ detailRevision: string }>();
    expect(detailRevision).toMatch(/^[a-f0-9]{64}$/);
    const url = `/devices/app-id/detail?revision=${detailRevision}`;
    app.status = AndroidApplicationStatus.Running;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Ready;
    app.updatedAt = new Date('2026-11-02T00:00:00Z');
    app.lastScrcpyActivityAt = app.updatedAt;
    const delta = await server.inject({ method: 'GET', url });
    expect(delta.statusCode).toBe(200);
    expect(delta.json()).toMatchObject({
      ownerUserId: 'owner',
      state: {
        status: {
          currentStatus: AndroidApplicationStatus.Running,
          lastScrcpyActivityAt: app.updatedAt.toISOString(),
        },
      },
      app: null,
    });
    app.name = 'Updated name';
    const changed = await server.inject({ method: 'GET', url });
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({
      state: null,
      app: {
        name: 'Updated name',
        detailRevision: expect.not.stringMatching(detailRevision) as unknown,
      },
    });
  });
});
