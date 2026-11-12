import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { ApplicationProfileMode } from '../../contracts/application-profile-mode';
import type { AndroidAutomationApplication } from '../../contracts/android-apps-automation.port';
import { AndroidAppsRuntimeOperationGate } from './android-apps-runtime-operation-gate.service';

const target: AndroidAutomationApplication = {
  id: 'app',
  ownerUserId: 'owner',
  status: AndroidApplicationStatus.Running,
  statusMessage: null,
  profileMode: ApplicationProfileMode.Persistent,
  profileName: 'default',
  containerId: 'container',
  containerName: 'device',
  networkName: 'device-network',
  adbPort: 5555,
  lastStartedAt: new Date(100),
  networkPolicyEnabled: true,
  networkPolicyAllowCidrs: '[]',
};

it('rejects a tap after the observed runtime restarts in the same container', async () => {
  const getStored = jest
    .fn()
    .mockResolvedValueOnce(target)
    .mockResolvedValueOnce({ ...target, lastStartedAt: new Date(200) });
  const gate = new AndroidAppsRuntimeOperationGate({ getStored } as never);
  await gate.run(target, undefined, async () => 'screen');
  const tap = jest.fn();
  await expect(gate.run(target, undefined, tap)).rejects.toThrow(
    'The Android runtime changed during this workflow run.',
  );
  expect(tap).not.toHaveBeenCalled();
});

it('fences new operations while Stop drains an admitted mutation', async () => {
  const gate = new AndroidAppsRuntimeOperationGate({
    getStored: jest.fn().mockResolvedValue(target),
  } as never);
  let resume!: () => void;
  let entered!: () => void;
  const held = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const command = gate.run(target, undefined, async () => {
    entered();
    await held;
  });
  await started;
  const stop = jest.fn();
  const stopping = gate.interrupt(target.id, stop);
  try {
    await expect(gate.run(target, undefined, jest.fn())).rejects.toThrow(
      'An Android runtime change is in progress.',
    );
    expect(stop).not.toHaveBeenCalled();
  } finally {
    resume();
    await command;
    await stopping;
  }
  expect(stop).toHaveBeenCalledTimes(1);
});
