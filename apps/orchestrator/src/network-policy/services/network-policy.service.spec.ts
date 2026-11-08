import { ConfigService } from '@nestjs/config';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import type { NetworkPolicyTarget } from '../../android-apps/contracts/android-apps-runtime-inventory.port';
import type { DockerEnginePort } from '../../docker/contracts/docker-engine.port';
import type { DockerNetworkRuntimePort } from '../../docker/contracts/docker-network-runtime.port';
import type { DockerSidecarPort } from '../../docker/contracts/docker-sidecar.port';
import { FirewallAgentClientService } from './firewall-agent-client.service';
import { NetworkPolicyService } from './network-policy.service';

describe('disabled firewall policy enforcement', () => {
  const agent = { apply: jest.fn(), remove: jest.fn() };
  const read = jest.fn();
  const service = new NetworkPolicyService(
    {} as ConfigService,
    { read } as unknown as DockerEnginePort,
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
      expect(read).not.toHaveBeenCalled();
    },
  );
});
