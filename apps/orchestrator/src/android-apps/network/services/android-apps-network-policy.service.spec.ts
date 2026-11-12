import type { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsPolicyGate } from '../../common/services/android-apps-policy-gate.service';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { AndroidAppsNetworkPolicyService } from './android-apps-network-policy.service';

it('applies workflow CIDR deltas to the latest administrative replacement', async () => {
  let stored = {
    id: 'app',
    status: AndroidApplicationStatus.Stopped,
    networkPolicyEnabled: true,
    networkPolicyAllowCidrs: '["192.0.2.1/32"]',
  };
  const saveNetworkPolicyConfiguration = jest.fn(
    async (_id: string, update: Partial<AndroidApplication>) => {
      stored = { ...stored, ...update };
      return true;
    },
  );
  let entered!: () => void;
  let release!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  saveNetworkPolicyConfiguration.mockImplementationOnce(async (_id, update) => {
    entered();
    await held;
    stored = { ...stored, ...update };
    return true;
  });
  const service = new AndroidAppsNetworkPolicyService(
    { reconcilePolicy: jest.fn() } as never,
    { decorate: (app: AndroidApplication) => app } as never,
    { reconcileById: async () => ({ ...stored }) } as never,
    { saveNetworkPolicyConfiguration } as never,
    {} as never,
    { assertEnabled: jest.fn() } as never,
    new AndroidAppsPolicyGate(),
  );

  const replacement = service.updateNetworkPolicy(
    'app',
    { networkPolicyAllowCidrs: ['198.51.100.1/32', '198.51.100.2/32'] },
    false,
  );
  await started;
  try {
    await expect(
      service.changeAllowedCidr(
        'app',
        { operation: 'add', cidr: '203.0.113.1' },
        false,
      ),
    ).rejects.toThrow('A network policy change is already in progress');
  } finally {
    release();
    await replacement;
  }
  await service.changeAllowedCidr(
    'app',
    { operation: 'add', cidr: '203.0.113.1' },
    false,
  );
  await service.changeAllowedCidr(
    'app',
    { operation: 'remove', cidr: '198.51.100.2' },
    false,
  );
  expect(JSON.parse(stored.networkPolicyAllowCidrs)).toEqual([
    '198.51.100.1/32',
    '203.0.113.1/32',
  ]);
  await expect(
    service.changeAllowedCidr(
      'app',
      { operation: 'add', cidr: '0.0.0.0/0' },
      false,
    ),
  ).rejects.toThrow(
    'You do not have permission to allow broad internet access.',
  );
  expect(saveNetworkPolicyConfiguration).toHaveBeenCalledTimes(3);
});
