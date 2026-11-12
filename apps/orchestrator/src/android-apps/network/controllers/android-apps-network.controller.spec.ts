import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { FeatureFlagsGuard } from '../../../feature-flags/feature-flags.guard';
import {
  FeatureDisabledException,
  FeatureFlagsService,
} from '../../../feature-flags/feature-flags.service';
import { NetworkPolicyService } from '../../../network-policy/services/network-policy.service';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsController } from '../../common/controllers/android-apps.controller';
import type { AndroidApplicationResponseDto } from '../../common/dto/android-application-response.dto';
import { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import { AndroidAppsPolicyGate } from '../../common/services/android-apps-policy-gate.service';
import { AndroidAppsRuntimeStateReconciler } from '../../common/services/android-apps-runtime-state-reconciler.service';
import { AndroidAppsStateWriter } from '../../common/services/android-apps-state-writer.service';
import { AndroidAppsStatusService } from '../../common/services/android-apps-status.service';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import { AndroidAppsLifecycleService } from '../../lifecycle/services/android-apps-lifecycle.service';
import { AndroidAppsNetworkPolicyService } from '../services/android-apps-network-policy.service';
import { AndroidAppsRuntimeNetworkService } from '../services/android-apps-runtime-network.service';
import { AndroidAppsNetworkController } from './android-apps-network.controller';

describe('application network policy', () => {
  let server: NestFastifyApplication;
  let app: AndroidApplication;
  let firewallEnabled: boolean;
  const save = jest.fn();
  const reconcilePolicy = jest.fn();
  const reapplyRunningPolicy = jest.fn();

  beforeEach(async () => {
    firewallEnabled = false;
    app = {
      id: 'app-1',
      name: 'Test app',
      networkPolicyEnabled: true,
      networkPolicyAllowCidrs: '[]',
      status: AndroidApplicationStatus.Stopped,
      lifecycleStage: AndroidApplicationLifecycleStage.Stopped,
    } as AndroidApplication;
    save.mockReset().mockImplementation((_id, patch) => {
      Object.assign(app, patch);
      return Promise.resolve(true);
    });
    reconcilePolicy.mockReset().mockResolvedValue(undefined);
    reapplyRunningPolicy.mockReset().mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      controllers: [AndroidAppsNetworkController, AndroidAppsController],
      providers: [
        AndroidAppsNetworkPolicyService,
        AndroidAppsPolicyGate,
        {
          provide: AndroidAppsQueryService,
          useValue: new AndroidAppsQueryService(
            {
              findById: async () => ({ ...app }),
              findForList: async () => [{ ...app }],
            } as never,
            new AndroidAppsStatusService(),
          ),
        },
        { provide: AndroidAppsLifecycleService, useValue: {} },
        {
          provide: FeatureFlagsService,
          useValue: {
            assertEnabled: () => {
              if (!firewallEnabled)
                throw new FeatureDisabledException('feature.firewall');
            },
          },
        },
        {
          provide: AndroidAppsRuntimeNetworkService,
          useValue: { reconcilePolicy, reapplyRunningPolicy },
        },
        {
          provide: AndroidAppsRuntimeStateReconciler,
          useValue: { reconcileById: async () => ({ ...app }) },
        },
        {
          provide: AndroidAppsStateWriter,
          useValue: { saveNetworkPolicyConfiguration: save },
        },
        { provide: NetworkPolicyService, useValue: {} },
      ],
    }).compile();
    server = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    server.useGlobalGuards(
      new FeatureFlagsGuard(new Reflector(), module.get(FeatureFlagsService)),
    );
    server.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await server.init();
    await server.getHttpAdapter().getInstance().ready();
  });

  afterEach(() => server.close());

  it('reports the same enforcement on the app and list reads after a successful retry', async () => {
    firewallEnabled = true;
    app.status = AndroidApplicationStatus.Running;
    app.lifecycleStage = AndroidApplicationLifecycleStage.Ready;
    reapplyRunningPolicy.mockImplementationOnce(
      (runtime: AndroidApplication) => {
        const result = {
          networkPolicyStatus: 'applied',
          networkPolicyMessage: 'Firewall rules applied.',
          networkPolicyAppliedAt: new Date(),
        };
        Object.assign(app, result);
        Object.assign(runtime, result);
        return Promise.resolve();
      },
    );

    const retried = await server.inject({
      method: 'POST',
      url: '/apps/app-1/network-policy/apply',
    });
    expect(retried.statusCode).toBe(201);
    expect(retried.json().networkPolicy.status).toBe('applied');

    const list = await server.inject({ method: 'GET', url: '/apps' });
    const detail = await server.inject({ method: 'GET', url: '/apps/app-1' });
    expect(list.statusCode).toBe(200);
    expect(detail.statusCode).toBe(200);
    const [listed] = list.json<AndroidApplicationResponseDto[]>();
    expect(listed.network.policy.result?.status).toBe('applied');
    expect(detail.json<AndroidApplicationResponseDto>().network.policy).toEqual(
      listed.network.policy,
    );
  });

  it('saves a disabled policy and retained allowlist through the API', async () => {
    const response = await server.inject({
      method: 'PATCH',
      url: '/apps/app-1/network-policy',
      headers: { 'x-rebroid-allow-broad-egress': 'true' },
      payload: {
        networkPolicyEnabled: false,
        networkPolicyAllowCidrs: ['10.0.0.0/8'],
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().networkPolicy).toMatchObject({
      enabled: false,
      allowCidrs: ['10.0.0.0/8'],
    });
    expect(save).toHaveBeenCalledWith(app.id, {
      networkPolicyEnabled: false,
      networkPolicyAllowCidrs: '["10.0.0.0/8"]',
    });
    expect(reconcilePolicy).toHaveBeenCalledWith(expect.objectContaining(app), {
      generation: expect.any(Number),
    });
    expect(reapplyRunningPolicy).not.toHaveBeenCalled();
  });

  it.each([true, undefined])(
    'rejects updates that leave restrictions enabled (%s) before persisting',
    async (networkPolicyEnabled) => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/apps/app-1/network-policy',
        payload: {
          networkPolicyEnabled,
          networkPolicyAllowCidrs: ['10.0.0.0/8'],
        },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ code: 'feature_disabled' });
      expect(save).not.toHaveBeenCalled();
      expect(app.networkPolicyEnabled).toBe(true);
      expect(app.networkPolicyAllowCidrs).toBe('[]');
      expect(reconcilePolicy).not.toHaveBeenCalled();
    },
  );

  it('can edit and apply an already disabled policy', async () => {
    app.networkPolicyEnabled = false;
    const response = await server.inject({
      method: 'PATCH',
      url: '/apps/app-1/network-policy',
      headers: { 'x-rebroid-allow-broad-egress': 'true' },
      payload: { networkPolicyAllowCidrs: ['10.0.0.0/8'] },
    });
    expect(response.statusCode).toBe(200);
    const applied = await server.inject({
      method: 'POST',
      url: '/apps/app-1/network-policy/apply',
    });
    expect(applied.statusCode).toBe(201);
    expect(applied.json().networkPolicy.enabled).toBe(false);
  });

  it('rejects applying a restricted policy and bulk reconciliation', async () => {
    for (const url of [
      '/apps/app-1/network-policy/apply',
      '/network-policies/reconcile',
    ]) {
      const response = await server.inject({ method: 'POST', url });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ code: 'feature_disabled' });
    }
    expect(reconcilePolicy).not.toHaveBeenCalled();
  });

  it.each([
    { networkPolicyEnabled: false },
    { networkPolicyAllowCidrs: ['1.0.0.0/17', '8.0.0.0/17'] },
  ])(
    'rejects ungranted broad egress before writing policy (%j)',
    async (payload) => {
      firewallEnabled = true;
      const response = await server.inject({
        method: 'PATCH',
        url: '/apps/app-1/network-policy',
        payload,
      });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        code: 'network_egress_forbidden',
      });
      expect(save).not.toHaveBeenCalled();
      expect(reconcilePolicy).not.toHaveBeenCalled();
    },
  );

  it('retains fail-closed enforcement when firewall is enabled', async () => {
    firewallEnabled = true;
    app.status = AndroidApplicationStatus.Running;
    const response = await server.inject({
      method: 'PATCH',
      url: '/apps/app-1/network-policy',
      payload: { networkPolicyEnabled: true },
    });
    expect(response.statusCode).toBe(200);
    expect(reapplyRunningPolicy).toHaveBeenCalledWith(
      expect.objectContaining(app),
      expect.any(Number),
    );
    expect(reconcilePolicy).not.toHaveBeenCalled();
  });
});
