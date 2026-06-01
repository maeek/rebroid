import { AndroidApplication } from '../../android-application.entity';
import { deriveNetworkPolicyResult } from './android-apps-network-policy-result.utils';

const appWithPolicyStatus = (
  overrides: Partial<AndroidApplication>,
): AndroidApplication =>
  ({
    id: 'app-1',
    containerId: 'container-1',
    networkPolicyEnabled: true,
    networkPolicyStatus: 'skipped',
    networkPolicyMessage: 'Firewall agent is unavailable.',
    ...overrides,
  }) as AndroidApplication;

describe('deriveNetworkPolicyResult', () => {
  it('reports an unavailable firewall agent safely', () => {
    expect(
      deriveNetworkPolicyResult(
        appWithPolicyStatus({ networkPolicyStatus: 'error' }),
      ),
    ).toEqual({
      status: 'error',
      code: 'agent_unavailable',
      message: 'Firewall agent is unavailable.',
      hint: 'Check firewall agent health and host firewall configuration, then apply the policy again.',
    });
  });
});
