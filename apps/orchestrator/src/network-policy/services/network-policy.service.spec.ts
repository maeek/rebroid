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
