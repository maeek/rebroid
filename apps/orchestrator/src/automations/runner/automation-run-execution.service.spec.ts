import { MetricsService } from '../../metrics/metrics.service';
import { AndroidApplicationStatus } from '../../android-apps/contracts/android-application-status';
import { ApplicationProfileMode } from '../../android-apps/contracts/application-profile-mode';
import { AutomationRunStatus } from '../entities/automation-run.entity';
import { AutomationAuthorizationError } from './automation-run-authorization.service';
import { AutomationRunExecutionService } from './automation-run-execution.service';
import { AutomationRunnerTargetService } from './automation-runner-target.service';
import { AutomationRunStartPolicy } from './automation-runner-options';

const queuedRun = {
  id: 'run-1',
  automationId: 'automation-1',
  ownerUserId: 'owner-1',
  targetApplicationId: 'app-1',
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
  admitTargetStart: async (start: () => Promise<unknown>) => {
    await start();
  },
});

const createExecution = ({
  getTarget = jest.fn().mockResolvedValue(target),
  start = jest.fn().mockResolvedValue(stoppedTarget),
  executeSteps = jest.fn().mockResolvedValue({ failed: false }),
  assertAllowed = jest.fn().mockResolvedValue(undefined),
  resolve = jest.fn().mockResolvedValue(runnable),
} = {}) => {
  const runs = {
    findById: jest.fn().mockResolvedValue(queuedRun),
  };
  const events = {
    transitionRun: jest.fn(),
  };
  const ephemeral = { delete: jest.fn() };
  const service = new AutomationRunExecutionService(
    runs as never,
    events as never,
    { resolve } as never,
    { executeSteps } as never,
    new AutomationRunnerTargetService(
      { get: getTarget, start } as never,
      { assertAllowed } as never,
    ),
    ephemeral as never,
    new MetricsService(),
  );
  return {
    service,
    events,
    ephemeral,
    getTarget,
    start,
    executeSteps,
    assertAllowed,
  };
};

describe('AutomationRunExecutionService', () => {
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
      expect.any(Array),
      expect.objectContaining({
        status: AutomationRunStatus.Failed,
        error: expect.stringContaining('must be running'),
      }),
      expect.objectContaining({ type: 'run.failed' }),
    );
  });

  it('does not start a canceled target after deferred authorization resolves', async () => {
    const authorization = deferred<number>();
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
    authorization.resolve(1);
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
        assertAllowed: jest.fn().mockResolvedValue(2),
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
      expect.any(Array),
      expect.objectContaining({
        status: AutomationRunStatus.Failed,
        error: expect.stringContaining('profile "other"'),
      }),
      expect.objectContaining({ type: 'run.failed' }),
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
      [AutomationRunStatus.Queued, AutomationRunStatus.Running],
      expect.objectContaining({ status: AutomationRunStatus.Failed }),
      expect.objectContaining({
        type: 'run.failed',
        data: {
          requestId: 'auth-request-1',
          code: 'authorization_rejected',
          service: 'web',
          httpStatus: 403,
        },
      }),
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
      [AutomationRunStatus.Queued, AutomationRunStatus.Running],
      expect.objectContaining({ status: AutomationRunStatus.Failed }),
      expect.objectContaining({ type: 'run.failed' }),
    );
    expect(ephemeral.delete).toHaveBeenCalledWith(runnable.entity.id);
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
      [AutomationRunStatus.Queued],
      expect.objectContaining({ status: AutomationRunStatus.Running }),
      expect.objectContaining({ type: 'run.started' }),
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
    const { service, events } = createExecution();
    events.transitionRun
      .mockResolvedValueOnce(running)
      .mockResolvedValueOnce(completed);

    await service.execute(runInput());

    expect(events.transitionRun).toHaveBeenCalledWith(
      queuedRun.id,
      [AutomationRunStatus.Running],
      expect.objectContaining({ status: AutomationRunStatus.Success }),
      expect.objectContaining({ type: 'run.completed' }),
    );
  });

  it('fails a queued run whose definition disappeared', async () => {
    const resolve = jest.fn().mockResolvedValue(null);
    const { service, events, ephemeral } = createExecution({ resolve });
    events.transitionRun.mockResolvedValue({
      ...queuedRun,
      status: AutomationRunStatus.Failed,
      error: 'Automation definition is no longer available.',
    });

    await service.execute(runInput());

    expect(events.transitionRun).toHaveBeenCalledWith(
      queuedRun.id,
      [AutomationRunStatus.Queued, AutomationRunStatus.Running],
      expect.objectContaining({ status: AutomationRunStatus.Failed }),
      expect.objectContaining({ type: 'run.failed' }),
    );
    expect(ephemeral.delete).toHaveBeenCalledWith(queuedRun.automationId);
  });

  it.each([
    {
      label: 'failed',
      abort: false,
      stepFailed: true,
      status: AutomationRunStatus.Failed,
      event: 'run.failed',
    },
    {
      label: 'canceled',
      abort: true,
      stepFailed: false,
      status: AutomationRunStatus.Canceled,
      event: 'run.canceled',
    },
  ])('terminalizes a $label persisted run', async (scenario) => {
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
        options: { isRunCanceled: () => boolean },
      ) => {
        if (scenario.abort) controller.abort();
        expect(options.isRunCanceled()).toBe(scenario.abort);
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

    expect(events.transitionRun).toHaveBeenCalledWith(
      queuedRun.id,
      [AutomationRunStatus.Running],
      expect.objectContaining({ status: scenario.status }),
      expect.objectContaining({ type: scenario.event }),
    );
  });
});
