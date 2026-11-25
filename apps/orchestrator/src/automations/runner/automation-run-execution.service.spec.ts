import { MetricsService } from '../../metrics/metrics.service';
import { AndroidApplicationStatus } from '../../android-apps/contracts/android-application-status';
import { ApplicationProfileMode } from '../../android-apps/contracts/application-profile-mode';
import {
  AutomationRunStatus,
  AutomationRunTrigger,
} from '../entities/automation-run.entity';
import { Automation } from '../entities/automation.entity';
import { AutomationAuthorizationError } from './automation-run-authorization.service';
import { AutomationRunExecutionService } from './automation-run-execution.service';
import { AutomationRunnerService } from './automation-runner.service';
import { AutomationRunnerTargetService } from './automation-runner-target.service';
import { AutomationRunStartPolicy } from './automation-runner-options';

const queuedRun = {
  id: 'run-1',
  automationId: 'automation-1',
  ownerUserId: 'owner-1',
  targetDeviceId: 'app-1',
  targetProfileMode: null,
  targetProfileName: null,
  trigger: 'manual',
  status: AutomationRunStatus.Queued,
  startedAt: null,
};

const runnable = {
  definition: { spec: { steps: [] } },
  entity: { id: 'automation-1', ownerUserId: 'owner-1' },
  ephemeral: true,
};

const target = {
  id: 'app-1',
  status: AndroidApplicationStatus.Running,
  profileMode: ApplicationProfileMode.Persistent,
  profileName: 'default',
};

const stoppedTarget = { ...target, status: AndroidApplicationStatus.Stopped };

const startIfNeeded = {
  startPolicy: AutomationRunStartPolicy.StartIfNeeded,
};

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
};

const runInput = () => ({
  runId: queuedRun.id,
  automationId: queuedRun.automationId,
  abortSignal: new AbortController().signal,
  targetOptions: {},
  admitTargetWork: <T>(operation: () => Promise<T>) => operation(),
});

const createExecution = ({
  getTarget = jest.fn().mockResolvedValue(target),
  start = jest.fn().mockResolvedValue(stoppedTarget),
  executeSteps = jest.fn().mockResolvedValue({ failed: false }),
  assertAllowed = jest.fn().mockResolvedValue({ canUseInternet: false }),
  resolve = jest.fn().mockResolvedValue(runnable),
} = {}) => {
  const runs = {
    findById: jest.fn().mockResolvedValue(queuedRun),
  };
  const events = {
    transitionRun: jest.fn(),
    emitWhileQueued: jest.fn(),
  };
  const ephemeral = { delete: jest.fn() };
  const metrics = new MetricsService();
  const service = new AutomationRunExecutionService(
    runs as never,
    events as never,
    { resolve } as never,
    { executeSteps } as never,
    new AutomationRunnerTargetService(
      {
        get: getTarget,
        start,
        captureAutomationTarget: async (app: typeof target) => ({
          ...app,
          containerStartedAt: '2026-11-12T10:00:00Z',
        }),
      } as never,
      { assertAllowed } as never,
    ),
    ephemeral as never,
    metrics,
  );
  return {
    service,
    events,
    ephemeral,
    metrics,
    getTarget,
    start,
    executeSteps,
    assertAllowed,
  };
};

describe('AutomationRunExecutionService', () => {
  it('records target preparation before execution for a workflow that starts Android', async () => {
    const startRequest = deferred<typeof stoppedTarget>();
    const startEntered = deferred<void>();
    const { service, events } = createExecution({
      resolve: jest.fn().mockResolvedValue({ ...runnable, ephemeral: false }),
      getTarget: jest
        .fn()
        .mockResolvedValueOnce(stoppedTarget)
        .mockResolvedValueOnce(stoppedTarget)
        .mockResolvedValue(target),
      start: jest.fn(() => {
        startEntered.resolve();
        return startRequest.promise;
      }),
    });
    events.transitionRun.mockResolvedValue({
      ...queuedRun,
      status: AutomationRunStatus.Running,
    });

    const execution = service.execute({
      ...runInput(),
      targetOptions: startIfNeeded,
    });
    await startEntered.promise;
    expect(
      events.emitWhileQueued.mock.calls.map(([event]) => event.data.phase),
    ).toEqual(['checking-target', 'starting-app']);
    expect(events.transitionRun).not.toHaveBeenCalled();

    startRequest.resolve(stoppedTarget);
    await execution;
    expect(events.emitWhileQueued).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'run.preparing',
        data: {
          phase: 'waiting-for-android',
          profileMode: ApplicationProfileMode.Persistent,
          profileName: 'default',
        },
      }),
    );
    expect(events.transitionRun).toHaveBeenCalledWith(
      queuedRun.id,
      expect.anything(),
    );
  });

  it('attaches to an expected current profile without asking for a profile switch', async () => {
    const running = { ...target, profileName: 'test-profile' };
    const { service, events, assertAllowed, executeSteps, start } =
      createExecution({
        getTarget: jest.fn().mockResolvedValue(running),
      });
    events.transitionRun.mockResolvedValue({
      ...queuedRun,
      status: AutomationRunStatus.Running,
    });
    await service.execute({
      ...runInput(),
      targetOptions: {
        currentProfileOnly: true,
        startPolicy: AutomationRunStartPolicy.RequireRunning,
        targetProfileMode: running.profileMode,
        targetProfileName: running.profileName,
      },
    });
    expect(assertAllowed).toHaveBeenCalledWith(
      queuedRun.ownerUserId,
      runnable.definition,
      target.id,
      { operation: 'attach', profileMode: undefined, profileName: undefined },
      expect.any(AbortSignal),
    );
    expect(start).not.toHaveBeenCalled();
    expect(executeSteps).toHaveBeenCalled();
  });

  it('never starts a target that stopped after authorization to attach', async () => {
    const getTarget = jest
      .fn()
      .mockResolvedValueOnce(target)
      .mockResolvedValueOnce(stoppedTarget);
    const { service, events, start, executeSteps, assertAllowed } =
      createExecution({ getTarget });

    await service.execute({ ...runInput(), targetOptions: startIfNeeded });

    expect(assertAllowed).toHaveBeenCalledWith(
      queuedRun.ownerUserId,
      runnable.definition,
      target.id,
      expect.objectContaining({ operation: 'attach' }),
      expect.any(AbortSignal),
    );
    expect(start).not.toHaveBeenCalled();
    expect(executeSteps).not.toHaveBeenCalled();
    expect(events.transitionRun).toHaveBeenCalledWith(
      queuedRun.id,
      expect.objectContaining({
        status: AutomationRunStatus.Failed,
        error: expect.stringContaining('must be running'),
      }),
      undefined,
    );
  });

  it('does not start a canceled target after deferred authorization resolves', async () => {
    const authorization = deferred<{
      canUseInternet: boolean;
      maxOpenApps: number;
    }>();
    const authorizationStarted = deferred<void>();
    const assertAllowed = jest.fn(() => {
      authorizationStarted.resolve();
      return authorization.promise;
    });
    const { service, events, start } = createExecution({
      getTarget: jest.fn().mockResolvedValue(stoppedTarget),
      assertAllowed,
    });
    const request = runInput();
    const cancellation = new AbortController();
    const execution = service.execute({
      ...request,
      abortSignal: cancellation.signal,
      targetOptions: startIfNeeded,
    });
    await authorizationStarted.promise;
    cancellation.abort();
    authorization.resolve({ canUseInternet: false, maxOpenApps: 1 });
    await execution;

    expect(start).not.toHaveBeenCalled();
    expect(events.transitionRun).not.toHaveBeenCalled();
  });

  it('starts an omitted default profile without a switch and rejects a different ready profile', async () => {
    const getTarget = jest
      .fn()
      .mockResolvedValueOnce(stoppedTarget)
      .mockResolvedValueOnce(stoppedTarget)
      .mockResolvedValueOnce({ ...target, profileName: 'other' });
    const { service, events, start, executeSteps, assertAllowed } =
      createExecution({
        getTarget,
        assertAllowed: jest
          .fn()
          .mockResolvedValue({ canUseInternet: true, maxOpenApps: 2 }),
      });

    await service.execute({ ...runInput(), targetOptions: startIfNeeded });

    expect(assertAllowed).toHaveBeenCalledWith(
      queuedRun.ownerUserId,
      runnable.definition,
      target.id,
      { operation: 'start', profileMode: undefined, profileName: undefined },
      expect.any(AbortSignal),
    );
    expect(start).toHaveBeenCalledWith(target.id, undefined, 2);
    expect(executeSteps).not.toHaveBeenCalled();
    expect(events.transitionRun).toHaveBeenCalledWith(
      queuedRun.id,
      expect.objectContaining({
        status: AutomationRunStatus.Failed,
        error: expect.stringContaining('profile "other"'),
      }),
      undefined,
    );
  });

  it('asks for profile authorization when the default would change the stored profile', async () => {
    const assertAllowed = jest
      .fn()
      .mockRejectedValue(new Error('Switch permission required'));
    const { service, start } = createExecution({
      getTarget: jest
        .fn()
        .mockResolvedValue({ ...stoppedTarget, profileName: 'other' }),
      assertAllowed,
    });

    await service.execute({ ...runInput(), targetOptions: startIfNeeded });

    expect(assertAllowed).toHaveBeenCalledWith(
      queuedRun.ownerUserId,
      runnable.definition,
      target.id,
      {
        operation: 'start',
        profileMode: ApplicationProfileMode.Persistent,
        profileName: 'default',
      },
      expect.any(AbortSignal),
    );
    expect(start).not.toHaveBeenCalled();
  });

  it('fails closed before runtime preparation when current authorization is denied', async () => {
    const assertAllowed = jest
      .fn()
      .mockRejectedValue(
        new AutomationAuthorizationError(
          'Workflow authorization was rejected.',
          'auth-request-1',
          'authorization_rejected',
          403,
        ),
      );
    const { service, start, executeSteps, events } = createExecution({
      assertAllowed,
      getTarget: jest.fn().mockResolvedValue(stoppedTarget),
    });
    events.transitionRun.mockResolvedValue({
      ...queuedRun,
      status: AutomationRunStatus.Failed,
    });
    await service.execute({ ...runInput(), targetOptions: startIfNeeded });
    expect(start).not.toHaveBeenCalled();
    expect(executeSteps).not.toHaveBeenCalled();
    expect(events.transitionRun).toHaveBeenCalledWith(
      queuedRun.id,
      expect.objectContaining({ status: AutomationRunStatus.Failed }),
      {
        requestId: 'auth-request-1',
        code: 'authorization_rejected',
        service: 'web',
        httpStatus: 403,
      },
    );
  });

  it('terminalizes preparation failures and cleans ephemeral definitions', async () => {
    const getTarget = jest
      .fn()
      .mockRejectedValue(new Error('target preparation failed'));
    const { service, events, ephemeral } = createExecution({
      getTarget,
    });
    events.transitionRun.mockResolvedValue({
      ...queuedRun,
      status: AutomationRunStatus.Failed,
      error: 'target preparation failed',
    });

    await service.execute(runInput());

    expect(events.transitionRun).toHaveBeenCalledWith(
      queuedRun.id,
      expect.objectContaining({ status: AutomationRunStatus.Failed }),
      undefined,
    );
    expect(ephemeral.delete).toHaveBeenCalledWith(runnable.entity.id);
  });

  it('keeps the active gauge balanced when cancellation precedes the running transition response', async () => {
    const running = {
      ...queuedRun,
      status: AutomationRunStatus.Running,
      startedAt: new Date(),
    };
    const canceled = { ...running, status: AutomationRunStatus.Canceled };
    const { service, events, metrics, ephemeral, executeSteps } =
      createExecution();
    const runningPersisted = deferred<void>();
    const releaseRunningResponse = deferred<void>();
    events.transitionRun
      .mockImplementationOnce(async () => {
        runningPersisted.resolve();
        await releaseRunningResponse.promise;
        return running;
      })
      .mockResolvedValueOnce(canceled);
    const runner = new AutomationRunnerService(
      { findMetadataByOwnerAndId: async () => running } as never,
      { ...events, enqueueRun: async () => queuedRun } as never,
      ephemeral as never,
      service,
      metrics,
      { assertEnabled: jest.fn() } as never,
    );
    const executionFinished = deferred<void>();
    ephemeral.delete.mockImplementation(() => executionFinished.resolve());
    const workflow = Object.assign(new Automation(), runnable.entity, {
      definitionJson: JSON.stringify(runnable.definition),
    });
    await runner.enqueue(workflow, AutomationRunTrigger.Manual, {
      targetDeviceId: target.id,
    });
    await runningPersisted.promise;
    await expect(
      runner.cancel(queuedRun.ownerUserId, queuedRun.id),
    ).resolves.toBe(canceled);

    const beforeRelease = await metrics.registry.metrics();
    releaseRunningResponse.resolve();
    await executionFinished.promise;
    const afterRelease = await metrics.registry.metrics();
    expect(beforeRelease).toContain('rebroid_automation_active_runs 0\n');
    expect(afterRelease).toContain('rebroid_automation_active_runs 0\n');
    expect(afterRelease).toContain(
      'rebroid_automation_runs_total{trigger="manual",outcome="canceled"} 1\n',
    );
    expect(afterRelease).toContain(
      'rebroid_automation_run_duration_seconds_count{trigger="manual",outcome="canceled"} 1\n',
    );
    expect(executeSteps).not.toHaveBeenCalled();
  });

  it('does not overwrite a cancellation that wins the terminal transition', async () => {
    const running = {
      ...queuedRun,
      status: AutomationRunStatus.Running,
      startedAt: new Date(),
      stepResultsJson: '[]',
    };
    const { service, events, ephemeral } = createExecution();
    events.transitionRun
      .mockResolvedValueOnce(running)
      .mockResolvedValueOnce(null);

    await service.execute(runInput());

    expect(events.transitionRun).toHaveBeenNthCalledWith(
      1,
      queuedRun.id,
      expect.objectContaining({ status: AutomationRunStatus.Running }),
    );
    expect(ephemeral.delete).toHaveBeenCalledWith(runnable.entity.id);
  });

  it('completes a prepared run and emits its terminal event', async () => {
    const startedAt = new Date();
    const running = {
      ...queuedRun,
      status: AutomationRunStatus.Running,
      startedAt,
      stepResultsJson: '[]',
    };
    const completed = {
      ...running,
      status: AutomationRunStatus.Success,
      completedAt: new Date(),
    };
    const { service, events, metrics, executeSteps } = createExecution();
    const stepsEntered = deferred<void>();
    const result = deferred<{ failed: boolean }>();
    executeSteps.mockImplementation(() => {
      stepsEntered.resolve();
      return result.promise;
    });
    events.transitionRun
      .mockResolvedValueOnce(running)
      .mockResolvedValueOnce(completed);

    const execution = service.execute(runInput());
    await stepsEntered.promise;
    const duringExecution = await metrics.registry.metrics();
    result.resolve({ failed: false });
    await execution;

    expect(duringExecution).toContain('rebroid_automation_active_runs 1\n');
    await expect(metrics.registry.metrics()).resolves.toContain(
      'rebroid_automation_active_runs 0\n',
    );
    expect(events.transitionRun).toHaveBeenCalledWith(
      queuedRun.id,
      expect.objectContaining({ status: AutomationRunStatus.Success }),
      undefined,
    );
  });

  it('fails a queued run whose definition disappeared', async () => {
    const resolve = jest.fn().mockResolvedValue(null);
    const { service, events, ephemeral, metrics } = createExecution({
      resolve,
    });
    events.transitionRun.mockResolvedValue({
      ...queuedRun,
      status: AutomationRunStatus.Failed,
      error: 'Automation definition is no longer available.',
    });

    await service.execute(runInput());

    expect(events.transitionRun).toHaveBeenCalledWith(
      queuedRun.id,
      expect.objectContaining({ status: AutomationRunStatus.Failed }),
      undefined,
    );
    expect(ephemeral.delete).toHaveBeenCalledWith(queuedRun.automationId);
    await expect(metrics.registry.metrics()).resolves.toContain(
      'rebroid_automation_runs_total{trigger="manual",outcome="failed"} 1',
    );
  });

  it.each([
    {
      label: 'failed',
      abort: false,
      stepFailed: true,
      status: AutomationRunStatus.Failed,
    },
    {
      label: 'canceled',
      abort: true,
      stepFailed: false,
      status: AutomationRunStatus.Canceled,
    },
  ])(
    'preserves the terminal outcome of a $label persisted run',
    async (scenario) => {
      const controller = new AbortController();
      const running = {
        ...queuedRun,
        status: AutomationRunStatus.Running,
        startedAt: new Date(),
        stepResultsJson: '[]',
      };
      const completed = { ...running, status: scenario.status };
      const resolve = jest.fn().mockResolvedValue({
        ...runnable,
        ephemeral: false,
      });
      const executeSteps = jest.fn(
        async (
          _steps: unknown,
          _state: unknown,
          _run: unknown,
          options: { abortSignal: AbortSignal },
        ) => {
          if (scenario.abort) controller.abort();
          expect(options.abortSignal.aborted).toBe(scenario.abort);
          return { failed: scenario.stepFailed };
        },
      );
      const { service, events } = createExecution({
        resolve,
        executeSteps,
      });
      events.transitionRun
        .mockResolvedValueOnce(running)
        .mockResolvedValueOnce(completed);

      await service.execute({
        ...runInput(),
        abortSignal: controller.signal,
      });

      if (scenario.abort) {
        // The command-facing runner owns cancellation after its drain completes.
        expect(events.transitionRun).toHaveBeenCalledTimes(1);
      } else {
        expect(events.transitionRun).toHaveBeenCalledWith(
          queuedRun.id,
          expect.objectContaining({ status: scenario.status }),
          undefined,
        );
      }
    },
  );
});
