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
    networkPolicyMessage:
      'IPTables policy is disabled. Containers use normal Docker internet and DNS egress, and per-app outbound allowlists are not enforced.',
    ...overrides,
  }) as AndroidApplication;

describe('deriveNetworkPolicyResult', () => {
  it('explains that disabled iptables allows normal Docker egress', () => {
    expect(deriveNetworkPolicyResult(appWithPolicyStatus({}), false)).toEqual({
      status: 'skipped',
      code: 'iptables_disabled',
      message:
        'IPTables policy is disabled. Containers use normal Docker internet and DNS egress, and per-app outbound allowlists are not enforced.',
      hint: 'Outbound internet and DNS use normal Docker egress. Per-app allowlists are not enforced unless IPTABLES_POLICY_ENABLED is enabled in a supported host firewall setup.',
    });
  });
});
