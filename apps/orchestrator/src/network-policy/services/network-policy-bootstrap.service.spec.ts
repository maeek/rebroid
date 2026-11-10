import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ContainerInspectInfo } from 'dockerode';
import type {
  AndroidAppsRuntimeInventoryPort,
  RestrictedRuntimePolicyTarget,
} from '../../android-apps/contracts/android-apps-runtime-inventory.port';
import type { DockerContainerLifecyclePort } from '../../docker/contracts/docker-container-lifecycle.port';
import type { DockerEnginePort } from '../../docker/contracts/docker-engine.port';
import type { DockerNetworkRuntimePort } from '../../docker/contracts/docker-network-runtime.port';
import type { DockerSidecarPort } from '../../docker/contracts/docker-sidecar.port';
import type { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import type { FirewallAgentClientService } from './firewall-agent-client.service';
import { NetworkPolicyBootstrapService } from './network-policy-bootstrap.service';
import { NetworkPolicyRuntimeService } from './network-policy-runtime.service';
import { NetworkPolicyService } from './network-policy.service';

jest.mock('node:timers/promises', () => ({
  setTimeout: jest.fn().mockResolvedValue(undefined),
}));

function target(id: string): RestrictedRuntimePolicyTarget {
  return {
    id,
    containerId: `container-${id}`,
    networkName: `network-${id}`,
    networkPolicyEnabled: true,
    networkPolicyRevision: 0,
    networkPolicyAllowCidrs: '["192.0.2.0/24"]',
  };
}

function inspection(
  app: RestrictedRuntimePolicyTarget,
  state: Partial<ContainerInspectInfo['State']>,
  address = '10.0.0.2',
) {
  return {
    Id: app.containerId,
    Config: {
      Labels: {
        'com.rebroid.managed': 'true',
        'com.rebroid.application-id': app.id,
        'com.rebroid.component': 'runtime',
      },
    },
    State: state,
    NetworkSettings: {
      Networks: { [app.networkName]: { IPAddress: address } },
    },
  };
}

const running = { Status: 'running', Running: true };
const notFound = { statusCode: 404 };

function setup(...apps: RestrictedRuntimePolicyTarget[]) {
  const config = new ConfigService({
    app: { networkPolicy: { bootstrap: true, defaultAllowDestinations: [] } },
  });
  const inventory: AndroidAppsRuntimeInventoryPort = {
    findExistingIds: jest.fn(),
    findRestrictedRuntimePolicyTargets: jest.fn().mockResolvedValue(apps),
  };
  const containers = {
    inspectContainer: jest.fn(),
    stopContainer: jest.fn().mockResolvedValue(undefined),
  };
  const agent = {
    apply: jest.fn().mockResolvedValue({ status: 'applied' }),
    reconcile: jest.fn().mockResolvedValue({ status: 'applied' }),
    remove: jest.fn(),
  };
  const features = { isEnabled: () => true } as unknown as FeatureFlagsService;
  const containerPort = containers as unknown as DockerContainerLifecyclePort;
  const runtimes = new NetworkPolicyRuntimeService(containerPort, {
    isDockerNotFound: (error: unknown) => error === notFound,
  } as DockerEnginePort);
  const policies = new NetworkPolicyService(
    config,
    runtimes,
    {} as DockerNetworkRuntimePort,
    { getSidecarIp: async () => null } as unknown as DockerSidecarPort,
    agent as unknown as FirewallAgentClientService,
    features,
  );
  const bootstrap = new NetworkPolicyBootstrapService(
    config,
    inventory,
    policies,
    runtimes,
    containerPort,
    features,
  );
  return { bootstrap, inventory, containers, agent };
}

describe('Firewall policy startup recovery', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('restores live runtimes and omits containers confirmed stopped or missing', async () => {
    const live = target('live');
    const stopped = target('stopped');
    const missing = target('missing');
    const { bootstrap, containers, agent } = setup(live, stopped, missing);
    containers.inspectContainer
      .mockResolvedValueOnce(inspection(live, running))
      .mockResolvedValueOnce(
        inspection(stopped, { Status: 'exited', Running: false }),
      )
      .mockRejectedValueOnce(notFound);

    await bootstrap.onApplicationBootstrap();

    expect(containers.inspectContainer.mock.calls).toEqual([
      [live.containerId],
      [stopped.containerId],
      [missing.containerId],
    ]);
    expect(agent.reconcile).toHaveBeenCalledTimes(1);
    expect(agent.reconcile).toHaveBeenCalledWith(
      [
        {
          applicationId: live.id,
          containerId: live.containerId,
          containerIp: '10.0.0.2',
          enabled: true,
          allowCidrs: ['192.0.2.0/24'],
          generation: expect.any(Number),
          revision: 0,
        },
      ],
      expect.any(Number),
    );
    expect(agent.apply).not.toHaveBeenCalled();
    expect(containers.stopContainer).not.toHaveBeenCalled();
  });

  it('retries an incomplete inventory and only prunes after Docker confirms the state', async () => {
    const app = target('app');
    const { bootstrap, containers, agent } = setup(app);
    containers.inspectContainer
      .mockRejectedValueOnce(new Error('Docker inspection timed out'))
      .mockImplementationOnce(async () => {
        expect(agent.reconcile).not.toHaveBeenCalled();
        return inspection(app, { Status: 'exited', Running: false });
      });

    await bootstrap.onApplicationBootstrap();

    expect(containers.inspectContainer).toHaveBeenCalledTimes(2);
    expect(agent.reconcile).toHaveBeenCalledTimes(1);
    expect(agent.reconcile).toHaveBeenCalledWith([], expect.any(Number));
    expect(containers.stopContainer).not.toHaveBeenCalled();
  });

  it.each(['timeout', 'restarting', 'mismatched identity'] as const)(
    'preserves rules when inspection is uncertain (%s) and refreshes verified runtimes',
    async (condition) => {
      const live = target('live');
      const unresolved = target('unresolved');
      const { bootstrap, containers, agent } = setup(live, unresolved);
      containers.inspectContainer.mockImplementation(async (id: string) => {
        if (id === live.containerId) return inspection(live, running);
        if (condition === 'timeout')
          throw new Error('Docker inspection timed out');
        if (condition === 'restarting') {
          return inspection(unresolved, {
            Status: 'restarting',
            Running: false,
            Restarting: true,
          });
        }
        return {
          ...inspection(unresolved, running),
          Id: 'unexpected-container',
        };
      });

      await bootstrap.onApplicationBootstrap();

      expect(agent.reconcile).not.toHaveBeenCalled();
      expect(agent.remove).not.toHaveBeenCalled();
      expect(agent.apply).toHaveBeenCalled();
      expect(agent.apply.mock.calls.every(([id]) => id === live.id)).toBe(true);
      expect(containers.stopContainer).not.toHaveBeenCalled();
    },
  );

  it('keeps rules for a live runtime without an address and only stops it after re-verifying ownership', async () => {
    const live = target('live');
    const changed = target('changed');
    const { bootstrap, inventory, containers, agent } = setup(live, changed);
    containers.inspectContainer.mockImplementation(async (id: string) => {
      if (id === live.containerId) return inspection(live, running, '');
      return inspection(changed, running, '');
    });
    jest
      .mocked(inventory.findRestrictedRuntimePolicyTargets)
      .mockImplementation(async (ids) => {
        if (!ids) return [live, changed];
        return ids.includes(live.id)
          ? [live]
          : [{ ...changed, containerId: 'replacement' }];
      });

    await bootstrap.onApplicationBootstrap();

    expect(agent.reconcile).not.toHaveBeenCalled();
    expect(agent.apply).not.toHaveBeenCalled();
    expect(agent.remove).not.toHaveBeenCalled();
    expect(containers.stopContainer.mock.calls).toEqual([[live.containerId]]);
  });

  it.each([false, true])(
    'rechecks an uncertain runtime and stops it only if the saved revision still matches (changed = %s)',
    async (changed) => {
      const app = target('uncertain');
      const { bootstrap, inventory, containers, agent } = setup(app);
      containers.inspectContainer.mockImplementation(async () => {
        if (containers.inspectContainer.mock.calls.length <= 30) {
          throw new Error('Docker inspection timed out');
        }
        return inspection(app, running);
      });
      const findTargets = jest.mocked(
        inventory.findRestrictedRuntimePolicyTargets,
      );
      findTargets.mockImplementation(async (ids) =>
        ids && changed
          ? [{ ...app, networkPolicyRevision: app.networkPolicyRevision + 1 }]
          : [app],
      );

      await bootstrap.onApplicationBootstrap();

      expect(containers.inspectContainer).toHaveBeenCalledTimes(31);
      expect(findTargets).toHaveBeenLastCalledWith([app.id]);
      expect(containers.stopContainer.mock.calls).toEqual(
        changed ? [] : [[app.containerId]],
      );
      expect(agent.reconcile).not.toHaveBeenCalled();
      expect(agent.remove).not.toHaveBeenCalled();
    },
  );
});
