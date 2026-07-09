import { MetricsService } from '../../metrics/metrics.service';
import { AutomationRunStatus } from '../entities/automation-run.entity';
import { AutomationRunExecutionService } from './automation-run-execution.service';

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

const createExecution = ({
  prepareTarget = jest
    .fn()
    .mockResolvedValue({ profileMode: 'persistent', profileName: 'default' }),
  executeSteps = jest.fn().mockResolvedValue({ failed: false }),
  resolve = jest.fn().mockResolvedValue(runnable),
} = {}) => {
  const runs = {
    findById: jest.fn().mockResolvedValue(queuedRun),
    transition: jest.fn(),
  };
  const events = { emit: jest.fn().mockResolvedValue(undefined) };
  const ephemeral = { delete: jest.fn() };
  const finalizer = { updatePersistedAutomationAfterRun: jest.fn() };
  const service = new AutomationRunExecutionService(
    runs as never,
    { get: jest.fn().mockResolvedValue({ id: 'app-1' }) } as never,
    events as never,
    { resolve } as never,
    finalizer as never,
    { executeSteps } as never,
    { prepareTarget } as never,
    ephemeral as never,
    new MetricsService(),
  );
  return {
    service,
    runs,
    events,
    ephemeral,
    finalizer,
    prepareTarget,
    executeSteps,
  };
};

describe('AutomationRunExecutionService', () => {
  it('terminalizes preparation failures and cleans ephemeral definitions', async () => {
    const prepareTarget = jest
      .fn()
      .mockRejectedValue(new Error('target preparation failed'));
    const { service, runs, events, ephemeral } = createExecution({
      prepareTarget,
    });
    runs.transition.mockResolvedValue({
      ...queuedRun,
      status: AutomationRunStatus.Failed,
      error: 'target preparation failed',
    });

    await service.execute({
      runId: queuedRun.id,
      automationId: queuedRun.automationId,
      abortSignal: new AbortController().signal,
      targetOptions: { targetApplicationId: queuedRun.targetApplicationId },
    });

    expect(runs.transition).toHaveBeenCalledWith(
      queuedRun.id,
      [AutomationRunStatus.Queued, AutomationRunStatus.Running],
      expect.objectContaining({ status: AutomationRunStatus.Failed }),
    );
    expect(events.emit).toHaveBeenCalledWith(
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
    const { service, runs, events, ephemeral } = createExecution();
    runs.transition
      .mockResolvedValueOnce({
        ...queuedRun,
        targetProfileMode: 'persistent',
        targetProfileName: 'default',
      })
      .mockResolvedValueOnce(running)
      .mockResolvedValueOnce(null);

    await service.execute({
      runId: queuedRun.id,
      automationId: queuedRun.automationId,
      abortSignal: new AbortController().signal,
      targetOptions: { targetApplicationId: queuedRun.targetApplicationId },
    });

    expect(events.emit).toHaveBeenCalledTimes(1);
    expect(events.emit).toHaveBeenCalledWith(
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
    const { service, runs, events } = createExecution();
    runs.transition
      .mockResolvedValueOnce({
        ...queuedRun,
        targetProfileMode: 'persistent',
        targetProfileName: 'default',
      })
      .mockResolvedValueOnce(running)
      .mockResolvedValueOnce(completed);

    await service.execute({
      runId: queuedRun.id,
      automationId: queuedRun.automationId,
      abortSignal: new AbortController().signal,
      targetOptions: { targetApplicationId: queuedRun.targetApplicationId },
    });

    expect(events.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'run.completed' }),
    );
  });

  it('fails a queued run whose definition disappeared', async () => {
    const resolve = jest.fn().mockResolvedValue(null);
    const { service, runs, events, ephemeral } = createExecution({ resolve });
    runs.transition.mockResolvedValue({
      ...queuedRun,
      status: AutomationRunStatus.Failed,
      error: 'Automation definition is no longer available.',
    });

    await service.execute({
      runId: queuedRun.id,
      automationId: queuedRun.automationId,
      abortSignal: new AbortController().signal,
      targetOptions: { targetApplicationId: queuedRun.targetApplicationId },
    });

    expect(events.emit).toHaveBeenCalledWith(
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
    if (scenario.abort) controller.abort();
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
        expect(options.isRunCanceled()).toBe(scenario.abort);
        return { failed: scenario.stepFailed };
      },
    );
    const { service, runs, events, finalizer } = createExecution({
      resolve,
      executeSteps,
    });
    runs.transition
      .mockResolvedValueOnce(queuedRun)
      .mockResolvedValueOnce(running)
      .mockResolvedValueOnce(completed);

    await service.execute({
      runId: queuedRun.id,
      automationId: queuedRun.automationId,
      abortSignal: controller.signal,
      targetOptions: { targetApplicationId: queuedRun.targetApplicationId },
    });

    expect(events.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: scenario.event }),
    );
    expect(finalizer.updatePersistedAutomationAfterRun).toHaveBeenCalledWith(
      expect.anything(),
      completed,
      true,
    );
  });
});
