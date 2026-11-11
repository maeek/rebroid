import { ConfigService } from '@nestjs/config';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import type { NetworkPolicyTarget } from '../../android-apps/contracts/android-apps-runtime-inventory.port';
import type { DockerNetworkRuntimePort } from '../../docker/contracts/docker-network-runtime.port';
import type { DockerSidecarPort } from '../../docker/contracts/docker-sidecar.port';
import { FirewallAgentClientService } from './firewall-agent-client.service';
import { NetworkPolicyService } from './network-policy.service';
import type { NetworkPolicyRuntimeService } from './network-policy-runtime.service';

describe('disabled firewall policy enforcement', () => {
  const agent = { apply: jest.fn(), remove: jest.fn() };
  const getContainerIp = jest.fn();
  const service = new NetworkPolicyService(
    {} as ConfigService,
    { getContainerIp } as unknown as NetworkPolicyRuntimeService,
    {} as DockerNetworkRuntimePort,
    {} as DockerSidecarPort,
    agent as unknown as FirewallAgentClientService,
    { isEnabled: () => false } as unknown as FeatureFlagsService,
  );

  it.each([false, true])(
    'skips unrestricted apps and rejects restricted enforcement (%s) without touching host rules',
    async (networkPolicyEnabled) => {
      const result = await service.apply({
        id: 'app-1',
        containerId: 'container-1',
        networkPolicyEnabled,
      } as NetworkPolicyTarget);
      expect(result.status).toBe(networkPolicyEnabled ? 'error' : 'skipped');
      expect(agent.apply).not.toHaveBeenCalled();
      expect(agent.remove).not.toHaveBeenCalled();
      expect(getContainerIp).not.toHaveBeenCalled();
    },
  );
});

describe('manual firewall reconciliation completeness', () => {
  const app = (id: string): NetworkPolicyTarget => ({
    id,
    containerId: `container-${id}`,
    networkName: `network-${id}`,
    networkPolicyEnabled: true,
    networkPolicyAllowCidrs: '[]',
    networkPolicyRevision: 1,
  });

  const setup = () => {
    const observeStartupRuntime = jest.fn();
    const agent = {
      reconcile: jest.fn().mockResolvedValue({ status: 'applied' }),
      apply: jest.fn().mockResolvedValue({ status: 'applied' }),
    };
    const service = new NetworkPolicyService(
      { get: () => [] } as unknown as ConfigService,
      { observeStartupRuntime } as unknown as NetworkPolicyRuntimeService,
      {} as DockerNetworkRuntimePort,
      { getSidecarIp: async () => null } as unknown as DockerSidecarPort,
      agent as unknown as FirewallAgentClientService,
      { isEnabled: () => true } as unknown as FeatureFlagsService,
    );
    return { service, agent, observeStartupRuntime };
  };

  it('retains installed policies when a live runtime address is unavailable', async () => {
    const { service, agent, observeStartupRuntime } = setup();
    observeStartupRuntime
      .mockResolvedValueOnce({ state: 'live', address: null })
      .mockResolvedValueOnce({ state: 'live', address: '10.1.0.2' });

    await expect(
      service.reconcile([app('unknown'), app('known')], 123),
    ).rejects.toThrow('incomplete');

    expect(agent.reconcile).not.toHaveBeenCalled();
    expect(agent.apply).toHaveBeenCalledWith(
      'known',
      expect.objectContaining({
        containerId: 'container-known',
        generation: 123,
        revision: 1,
      }),
    );
  });

  it('retains installed policies when runtime identity cannot be verified', async () => {
    const { service, agent, observeStartupRuntime } = setup();
    observeStartupRuntime.mockResolvedValue({
      state: 'uncertain',
      reason: 'engine unavailable',
    });
    await expect(service.reconcile([app('unknown')], 123)).rejects.toThrow(
      'incomplete',
    );
    expect(agent.reconcile).not.toHaveBeenCalled();
    expect(agent.apply).not.toHaveBeenCalled();
  });

  it('prunes a complete snapshot only after observing inactive runtimes', async () => {
    const { service, agent, observeStartupRuntime } = setup();
    observeStartupRuntime.mockResolvedValue({ state: 'inactive' });
    await service.reconcile([app('stopped')], 123);
    expect(agent.reconcile).toHaveBeenCalledWith([], 123);
  });
});
