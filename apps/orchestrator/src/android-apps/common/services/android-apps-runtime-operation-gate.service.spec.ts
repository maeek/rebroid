import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { ApplicationProfileMode } from '../../contracts/application-profile-mode';
import type { AndroidAutomationTarget } from '../../contracts/android-apps-automation.port';
import { AndroidAppsRuntimeOperationGate } from './android-apps-runtime-operation-gate.service';

const firstStart = '2026-11-12T10:00:00.000000001Z';
const secondStart = '2026-11-12T10:00:00.000000002Z';

const target: AndroidAutomationTarget = {
  id: 'app',
  ownerUserId: 'owner',
  status: AndroidApplicationStatus.Running,
  statusMessage: null,
  profileMode: ApplicationProfileMode.Persistent,
  profileName: 'default',
  containerId: 'container',
  containerStartedAt: firstStart,
  containerName: 'device',
  networkName: 'device-network',
  adbPort: 5555,
  lastStartedAt: new Date(100),
  networkPolicyEnabled: true,
  networkPolicyAllowCidrs: '[]',
};

const inspectRuntime = (StartedAt = firstStart) => ({
  Id: target.containerId,
  State: { Running: true, StartedAt },
});

it('rejects the next command after Docker restarts the same container with unchanged stored state', async () => {
  const inspectContainer = jest
    .fn()
    .mockResolvedValueOnce(inspectRuntime())
    .mockResolvedValueOnce(inspectRuntime(secondStart));
  const gate = new AndroidAppsRuntimeOperationGate(
    { getStored: async () => target } as never,
    { inspectContainer } as never,
  );
  const bound = await gate.capture(target, new AbortController().signal);
  const tap = jest.fn();

  await expect(gate.run(bound, undefined, tap)).rejects.toThrow(
    'The Android runtime changed during this workflow run.',
  );
  expect(tap).not.toHaveBeenCalled();
});

it('rejects a tap after the observed runtime restarts in the same container', async () => {
  const getStored = jest
    .fn()
    .mockResolvedValueOnce(target)
    .mockResolvedValueOnce({ ...target, lastStartedAt: new Date(200) });
  const gate = new AndroidAppsRuntimeOperationGate(
    { getStored } as never,
    { inspectContainer: async () => inspectRuntime() } as never,
  );
  await gate.run(target, undefined, async () => 'screen');
  const tap = jest.fn();
  await expect(gate.run(target, undefined, tap)).rejects.toThrow(
    'The Android runtime changed during this workflow run.',
  );
  expect(tap).not.toHaveBeenCalled();
});

it('treats an omitted workflow profile name as default and rejects a different owner', async () => {
  const getStored = jest
    .fn()
    .mockResolvedValueOnce({ ...target, profileName: null })
    .mockResolvedValueOnce({ ...target, ownerUserId: 'another-owner' });
  const inspectContainer = jest.fn().mockResolvedValue(inspectRuntime());
  const gate = new AndroidAppsRuntimeOperationGate(
    { getStored } as never,
    { inspectContainer } as never,
  );

  await expect(gate.run(target, undefined, async () => 'screen')).resolves.toBe(
    'screen',
  );
  await expect(gate.run(target, undefined, jest.fn())).rejects.toThrow(
    'The Android runtime changed during this workflow run.',
  );
  expect(inspectContainer).toHaveBeenCalledTimes(1);
});

it('fences new operations while Stop drains an admitted mutation', async () => {
  const gate = new AndroidAppsRuntimeOperationGate(
    { getStored: jest.fn().mockResolvedValue(target) } as never,
    { inspectContainer: async () => inspectRuntime() } as never,
  );
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

it('cancels an open terminal before draining it for Stop', async () => {
  const gate = new AndroidAppsRuntimeOperationGate(
    { getStored: jest.fn().mockResolvedValue(target) } as never,
    { inspectContainer: async () => inspectRuntime() } as never,
  );
  const controller = new AbortController();
  let entered!: () => void;
  let finishCleanup!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const cleanup = new Promise<void>((resolve) => {
    finishCleanup = resolve;
  });
  const shell = gate.withCurrentRuntime(
    target,
    controller.signal,
    async () => {
      entered();
      await cleanup;
    },
    () => controller.abort(),
  );
  await started;
  const stop = jest.fn();
  const stopping = gate.interrupt(target.id, stop);
  expect(controller.signal.aborted).toBe(true);
  expect(stop).not.toHaveBeenCalled();
  finishCleanup();
  await Promise.all([shell, stopping]);
  expect(stop).toHaveBeenCalledTimes(1);
});

it('defers an idle Stop while runtime work is admitted, leaving manual Stop free to interrupt', async () => {
  const gate = new AndroidAppsRuntimeOperationGate(
    { getStored: async () => target } as never,
    { inspectContainer: async () => inspectRuntime() } as never,
  );
  const cancel = jest.fn();
  const action = jest.fn();
  const stop = jest.fn();
  const pending = gate.withCurrentRuntime(
    target,
    undefined,
    async () => {
      action();
    },
    cancel,
  );
  await gate.runIfIdle(target.id, stop);
  expect(stop).not.toHaveBeenCalled();
  expect(cancel).not.toHaveBeenCalled();
  await pending;
  expect(action).toHaveBeenCalledTimes(1);
  await gate.runIfIdle(target.id, stop);
  expect(stop).toHaveBeenCalledTimes(1);
});

it('retains a shared cancellation callback while another operation still needs it', async () => {
  const gate = new AndroidAppsRuntimeOperationGate({} as never, {} as never);
  const cancel = jest.fn();
  let finish!: () => void;
  const held = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const first = gate.withApplicationOperation(
    target.id,
    async () => {},
    cancel,
  );
  const second = gate.withApplicationOperation(target.id, () => held, cancel);
  await first;
  const stop = jest.fn();
  const stopping = gate.interrupt(target.id, stop);
  try {
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
  } finally {
    finish();
    await Promise.all([second, stopping]);
  }
  expect(stop).toHaveBeenCalledTimes(1);
});
