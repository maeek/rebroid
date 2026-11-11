import { ConflictException } from '@nestjs/common';
import { MetricsService } from '../../metrics/metrics.service';
import {
  AutomationRunStatus,
  AutomationRunTrigger,
} from '../entities/automation-run.entity';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationRunsRepository } from '../persistence/automation-runs.repository';
import { AutomationRunExecutionService } from './automation-run-execution.service';
import { AutomationRunnerService } from './automation-runner.service';
import { EphemeralAutomationRegistryService } from './ephemeral-automation-registry.service';

const run = {
  id: 'run-1',
  automationId: 'automation-1',
  ownerUserId: 'owner-1',
  targetApplicationId: 'app-1',
  trigger: AutomationRunTrigger.Manual,
  status: AutomationRunStatus.Running,
  startedAt: new Date(),
};

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
};

const createService = (
  overrides: {
    runs?: object;
    events?: object;
    ephemeral?: object;
    execution?: object;
  } = {},
) => {
  const runs = {
    listAllActive: jest.fn().mockResolvedValue([]),
    ...overrides.runs,
  } as unknown as AutomationRunsRepository;
  const events = {
    emit: jest.fn().mockResolvedValue(undefined),
    ...overrides.events,
  } as unknown as AutomationRunEventBus;
  const ephemeral = {
    delete: jest.fn(),
    ...overrides.ephemeral,
  } as unknown as EphemeralAutomationRegistryService;
  const execution = {
    execute: jest.fn().mockResolvedValue(undefined),
    ...overrides.execution,
  } as unknown as AutomationRunExecutionService;
  return {
    runs,
    events,
    ephemeral,
    execution,
    service: new AutomationRunnerService(
      runs,
      events,
      ephemeral,
      execution,
      new MetricsService(),
    ),
  };
};

describe('AutomationRunnerService', () => {
  it('requires a target before reserving a run', async () => {
    const definition = {
      apiVersion: 'rebroid.io/v1alpha1',
      kind: 'Automation',
      metadata: { name: 'test' },
      spec: { steps: [] },
    } as never;
    const runnable = {
      definition,
      ephemeral: true,
      entity: { id: 'ephemeral-1', ownerUserId: 'owner-1' },
    };
    const { service } = createService({
      ephemeral: { create: jest.fn().mockReturnValue(runnable) },
    });

    await expect(
      service.enqueueEphemeral(
        'owner-1',
        definition,
        AutomationRunTrigger.Manual,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('converts the active-target unique constraint into a conflict', async () => {
    const definition = {
      apiVersion: 'rebroid.io/v1alpha1',
      kind: 'Automation',
      metadata: { name: 'test' },
      spec: { steps: [] },
    } as never;
    const runnable = {
      definition,
      ephemeral: true,
      entity: { id: 'ephemeral-1', ownerUserId: 'owner-1' },
    };
    const { service, ephemeral } = createService({
      runs: {
        create: jest.fn().mockReturnValue({}),
        save: jest.fn().mockRejectedValue({
          code: 'SQLITE_CONSTRAINT_UNIQUE',
        }),
      },
      ephemeral: {
        create: jest.fn().mockReturnValue(runnable),
        delete: jest.fn(),
      },
    });

    await expect(
      service.enqueueEphemeral(
        'owner-1',
        definition,
        AutomationRunTrigger.Manual,
        { targetApplicationId: 'app-1' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ephemeral.delete).toHaveBeenCalledWith('ephemeral-1');
  });

  it('records the ad hoc prompt before dispatching an ephemeral run', async () => {
    const definition = {
      apiVersion: 'rebroid.io/v1alpha1',
      kind: 'Automation',
      metadata: { name: 'test' },
      spec: { steps: [] },
    } as never;
    const runnable = {
      definition,
      ephemeral: true,
      entity: { id: 'ephemeral-1', ownerUserId: 'owner-1' },
    };
    const queued = {
      ...run,
      automationId: runnable.entity.id,
      status: AutomationRunStatus.Queued,
      startedAt: null,
    };
    const { service, events, execution } = createService({
      runs: {
        create: jest.fn().mockReturnValue(queued),
        save: jest.fn().mockResolvedValue(queued),
      },
      ephemeral: {
        create: jest.fn().mockReturnValue(runnable),
        delete: jest.fn(),
      },
    });

    await expect(
      service.enqueueEphemeral(
        'owner-1',
        definition,
        AutomationRunTrigger.Manual,
        { targetApplicationId: 'app-1' },
        { prompt: 'Open settings', clientMessageId: 'turn-1' },
      ),
    ).resolves.toBe(queued);
    await Promise.resolve();

    expect(events.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'run.queued' }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ai.user.message',
        message: 'Open settings',
        data: { clientMessageId: 'turn-1' },
      }),
    );
    expect(jest.mocked(events.emit).mock.invocationCallOrder[1]).toBeLessThan(
      jest.mocked(execution.execute).mock.invocationCallOrder[0],
    );
    expect(execution.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: queued.id,
        automationId: runnable.entity.id,
      }),
    );
  });

  it('enqueues persisted definitions and propagates unrelated storage errors', async () => {
    const automation = {
      ...run,
      definitionJson: JSON.stringify({
        apiVersion: 'rebroid.io/v1alpha1',
        kind: 'Automation',
        metadata: { name: 'test' },
        spec: { steps: [] },
      }),
    };
    const queued = { ...run, status: AutomationRunStatus.Queued };
    const success = createService({
      runs: {
        create: jest.fn().mockReturnValue(queued),
        save: jest.fn().mockResolvedValue(queued),
      },
    });
    await expect(
      success.service.enqueue(
        automation as never,
        AutomationRunTrigger.Manual,
        {
          targetApplicationId: 'app-1',
        },
      ),
    ).resolves.toBe(queued);

    const failure = createService({
      runs: {
        create: jest.fn().mockReturnValue(queued),
        save: jest.fn().mockRejectedValue(new Error('database offline')),
      },
    });
    await expect(
      failure.service.enqueue(
        automation as never,
        AutomationRunTrigger.Manual,
        {
          targetApplicationId: 'app-1',
        },
      ),
    ).rejects.toThrow('database offline');
  });

  it('fails the reservation when its queued event cannot be persisted', async () => {
    const definition = {
      apiVersion: 'rebroid.io/v1alpha1',
      kind: 'Automation',
      metadata: { name: 'test' },
      spec: { steps: [] },
    } as never;
    const runnable = {
      definition,
      ephemeral: true,
      entity: { id: 'ephemeral-1', ownerUserId: 'owner-1' },
    };
    const queued = {
      ...run,
      status: AutomationRunStatus.Queued,
      startedAt: null,
    };
    const transition = jest.fn().mockResolvedValue({
      ...queued,
      status: AutomationRunStatus.Failed,
    });
    const { service, ephemeral } = createService({
      runs: {
        create: jest.fn().mockReturnValue(queued),
        save: jest.fn().mockResolvedValue(queued),
        transition,
      },
      events: { emit: jest.fn().mockRejectedValue('event failed') },
      ephemeral: {
        create: jest.fn().mockReturnValue(runnable),
        delete: jest.fn(),
      },
    });

    await expect(
      service.enqueueEphemeral(
        'owner-1',
        definition,
        AutomationRunTrigger.Manual,
        { targetApplicationId: 'app-1' },
      ),
    ).rejects.toBe('event failed');
    expect(transition).toHaveBeenCalledWith(
      queued.id,
      [AutomationRunStatus.Queued],
      expect.objectContaining({
        status: AutomationRunStatus.Failed,
        error: 'event failed',
      }),
    );
    expect(ephemeral.delete).toHaveBeenCalledWith(runnable.entity.id);
  });

  it('guards cancellation and returns terminal runs unchanged', async () => {
    const canceled = {
      ...run,
      status: AutomationRunStatus.Canceled,
      completedAt: new Date(),
    };
    const transition = jest.fn().mockResolvedValue(canceled);
    const findByOwnerAndId = jest
      .fn()
      .mockResolvedValueOnce(run)
      .mockResolvedValueOnce(canceled);
    const { service, events } = createService({
      runs: { findByOwnerAndId, transition },
    });

    await expect(service.cancel('owner-1', 'run-1')).resolves.toBe(canceled);
    expect(transition).toHaveBeenCalledWith(
      run.id,
      [AutomationRunStatus.Queued, AutomationRunStatus.Running],
      expect.objectContaining({ status: AutomationRunStatus.Canceled }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'run.canceled' }),
    );

    await expect(service.cancel('owner-1', 'run-1')).resolves.toBe(canceled);
    expect(transition).toHaveBeenCalledTimes(1);
  });

  it('holds the target reservation during cancellation until an admitted Start settles', async () => {
    const automation = {
      ...run,
      definitionJson: JSON.stringify({ spec: { steps: [] } }),
    } as never;
    const queued = { ...run, status: AutomationRunStatus.Queued };
    let reserved: typeof queued | undefined;
    const startEntered = deferred();
    const startResponse = deferred();
    const abortReceived = deferred();
    const transition = jest.fn(() => {
      reserved = undefined;
      return { ...queued, status: AutomationRunStatus.Canceled };
    });
    const execute = jest.fn(
      async (
        input: Parameters<AutomationRunExecutionService['execute']>[0],
      ) => {
        input.abortSignal.addEventListener(
          'abort',
          () => abortReceived.resolve(),
          { once: true },
        );
        await input.admitTargetStart(() => {
          startEntered.resolve();
          return startResponse.promise;
        });
      },
    );
    const { service } = createService({
      runs: {
        create: jest.fn().mockReturnValue(queued),
        save: jest.fn(() => {
          if (reserved) throw { code: 'SQLITE_CONSTRAINT_UNIQUE' };
          reserved = queued;
          return queued;
        }),
        findByOwnerAndId: jest.fn(() => reserved),
        transition,
      },
      execution: { execute },
    });
    const enqueue = () =>
      service.enqueue(automation, AutomationRunTrigger.Manual, {
        targetApplicationId: queued.targetApplicationId,
      });
    await enqueue();
    await startEntered.promise;

    const cancellation = service.cancel(queued.ownerUserId, queued.id);
    await abortReceived.promise;

    expect(transition).not.toHaveBeenCalled();
    await expect(enqueue()).rejects.toThrow('already active');
    startResponse.resolve();
    await expect(cancellation).resolves.toMatchObject({
      status: AutomationRunStatus.Canceled,
    });
  });

  it('shares a cancellation signal with dispatch while the queued event is still publishing', async () => {
    const automation = {
      ...run,
      definitionJson: JSON.stringify({ spec: { steps: [] } }),
    } as never;
    const queued = { ...run, status: AutomationRunStatus.Queued };
    const queuedEventEntered = deferred();
    const queuedEventFinished = deferred();
    const cancelEntered = deferred();
    const cancelFinished = deferred();
    const { service, execution } = createService({
      runs: {
        create: jest.fn().mockReturnValue(queued),
        save: jest.fn().mockResolvedValue(queued),
        findByOwnerAndId: jest.fn().mockResolvedValue(queued),
        transition: jest.fn(async () => {
          cancelEntered.resolve();
          await cancelFinished.promise;
          return { ...queued, status: AutomationRunStatus.Canceled };
        }),
      },
      events: {
        emit: jest.fn().mockImplementationOnce(() => {
          queuedEventEntered.resolve();
          return queuedEventFinished.promise;
        }),
      },
    });
    const enqueued = service.enqueue(automation, AutomationRunTrigger.Manual, {
      targetApplicationId: queued.targetApplicationId,
    });
    await queuedEventEntered.promise;

    const cancellation = service.cancel(queued.ownerUserId, queued.id);
    await cancelEntered.promise;
    queuedEventFinished.resolve();
    await enqueued;

    expect(execution.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        abortSignal: expect.objectContaining({ aborted: true }),
      }),
    );
    cancelFinished.resolve();
    await cancellation;
  });

  it('handles missing runs and cancellation transition races', async () => {
    const missing = createService({
      runs: { findByOwnerAndId: jest.fn().mockResolvedValue(null) },
    });
    await expect(missing.service.cancel('owner-1', 'missing')).rejects.toThrow(
      'was not found',
    );

    const findByOwnerAndId = jest
      .fn()
      .mockResolvedValueOnce(run)
      .mockResolvedValueOnce(null);
    const raced = createService({
      runs: {
        findByOwnerAndId,
        transition: jest.fn().mockResolvedValue(null),
      },
    });
    await expect(raced.service.cancel('owner-1', run.id)).resolves.toBe(run);
  });

  it('contains rejected execution dispatches', async () => {
    const definition = {
      apiVersion: 'rebroid.io/v1alpha1',
      kind: 'Automation',
      metadata: { name: 'test' },
      spec: { steps: [] },
    } as never;
    const runnable = {
      definition,
      ephemeral: true,
      entity: { id: 'ephemeral-1', ownerUserId: 'owner-1' },
    };
    const queued = {
      ...run,
      status: AutomationRunStatus.Queued,
      startedAt: null,
    };
    const { service, execution } = createService({
      runs: {
        create: jest.fn().mockReturnValue(queued),
        save: jest.fn().mockResolvedValue(queued),
      },
      ephemeral: { create: jest.fn().mockReturnValue(runnable) },
      execution: { execute: jest.fn().mockRejectedValue('dispatch failed') },
    });

    await service.enqueueEphemeral(
      'owner-1',
      definition,
      AutomationRunTrigger.Manual,
      { targetApplicationId: 'app-1' },
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(execution.execute).toHaveBeenCalled();
  });

  it('terminalizes active runs during startup recovery', async () => {
    const failed = {
      ...run,
      status: AutomationRunStatus.Failed,
      error: 'Automation stopped because the orchestrator restarted.',
    };
    const transition = jest.fn().mockResolvedValue(failed);
    const { service, events } = createService({
      runs: {
        listAllActive: jest.fn().mockResolvedValue([run]),
        transition,
      },
    });

    await service.onApplicationBootstrap();

    expect(transition).toHaveBeenCalledWith(
      'run-1',
      [AutomationRunStatus.Queued, AutomationRunStatus.Running],
      expect.objectContaining({ status: AutomationRunStatus.Failed }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run-1', type: 'run.failed' }),
    );
  });
});
