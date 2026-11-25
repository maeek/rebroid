import { ConflictException } from '@nestjs/common';
import { MetricsService } from '../../metrics/metrics.service';
import {
  AutomationRunStatus,
  AutomationRunTrigger,
} from '../entities/automation-run.entity';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationRunTargetConflictError } from '../persistence/automation-run-events.repository';
import { AutomationRunsRepository } from '../persistence/automation-runs.repository';
import { AutomationRunExecutionService } from './automation-run-execution.service';
import { AutomationRunnerService } from './automation-runner.service';
import { EphemeralAutomationRegistryService } from './ephemeral-automation-registry.service';

const run = {
  id: 'run-1',
  automationId: 'automation-1',
  ownerUserId: 'owner-1',
  targetDeviceId: 'app-1',
  trigger: AutomationRunTrigger.Manual,
  status: AutomationRunStatus.Running,
  startedAt: new Date(),
};

const activeTargetConflict = new AutomationRunTargetConflictError();

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
    devices?: object;
  } = {},
) => {
  const runs = {
    listAllActive: jest.fn().mockResolvedValue([]),
    ...overrides.runs,
  } as unknown as AutomationRunsRepository;
  const events = {
    enqueueRun: jest
      .fn()
      .mockResolvedValue({ ...run, status: AutomationRunStatus.Queued }),
    transitionRun: jest.fn(),
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
      { assertEnabled: jest.fn() } as never,
      overrides.devices as never,
    ),
  };
};

describe('AutomationRunnerService', () => {
  it.each(['android.adbShell', 'android.pullFile'])(
    'rejects a nested external %s before reservation',
    async (uses) => {
      const definition = {
        apiVersion: 'rebroid.io/automation/v2',
        kind: 'Automation',
        metadata: { name: 'nested unsupported step' },
        spec: {
          steps: [
            {
              id: 'inspect',
              type: 'condition',
              then: [{ id: 'restricted', uses, with: {} }],
            },
          ],
        },
      } as never;
      const runnable = {
        definition,
        ephemeral: true,
        entity: { id: 'ephemeral-1', ownerUserId: 'owner-1' },
      };
      const { service, events } = createService({
        ephemeral: { create: jest.fn().mockReturnValue(runnable) },
        devices: {
          getAutomationDevice: jest
            .fn()
            .mockResolvedValue({ kind: 'external', ownerUserId: 'owner-1' }),
        },
      });
      await expect(
        service.enqueueEphemeral(
          'owner-1',
          definition,
          AutomationRunTrigger.Manual,
          {
            targetDeviceId: 'phone',
          },
        ),
      ).rejects.toThrow(uses);
      expect(events.enqueueRun).not.toHaveBeenCalled();
    },
  );

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

  it('reports a target reservation conflict to the caller', async () => {
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
      events: {
        enqueueRun: jest.fn().mockRejectedValue(activeTargetConflict),
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
        { targetDeviceId: 'app-1' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ephemeral.delete).toHaveBeenCalledWith('ephemeral-1');
  });

  it('preserves an event sequence error from the admission transaction', async () => {
    const error = Object.assign(
      new Error(
        'UNIQUE constraint failed: automation_run_events.runId, automation_run_events.sequence',
      ),
      { code: 'SQLITE_CONSTRAINT_UNIQUE' },
    );
    const { service, execution } = createService({
      events: { enqueueRun: jest.fn().mockRejectedValue(error) },
    });
    const automation = { ...run, definitionJson: '{}' } as never;

    await expect(
      service.enqueue(automation, AutomationRunTrigger.Manual, {
        targetDeviceId: run.targetDeviceId,
      }),
    ).rejects.toBe(error);
    expect(execution.execute).not.toHaveBeenCalled();
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
      events: { enqueueRun: jest.fn().mockResolvedValue(queued) },
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
        { targetDeviceId: 'app-1' },
        { prompt: 'Open settings', clientMessageId: 'turn-1' },
      ),
    ).resolves.toBe(queued);
    await Promise.resolve();

    expect(events.enqueueRun).toHaveBeenCalledWith(
      expect.objectContaining({ automationId: 'ephemeral-1' }),
      { prompt: 'Open settings', clientMessageId: 'turn-1' },
    );
    expect(
      jest.mocked(events.enqueueRun).mock.invocationCallOrder[0],
    ).toBeLessThan(jest.mocked(execution.execute).mock.invocationCallOrder[0]);
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
      events: { enqueueRun: jest.fn().mockResolvedValue(queued) },
    });
    await expect(
      success.service.enqueue(
        automation as never,
        AutomationRunTrigger.Manual,
        {
          targetDeviceId: 'app-1',
        },
      ),
    ).resolves.toBe(queued);

    const failure = createService({
      events: {
        enqueueRun: jest.fn().mockRejectedValue(new Error('database offline')),
      },
    });
    await expect(
      failure.service.enqueue(
        automation as never,
        AutomationRunTrigger.Manual,
        {
          targetDeviceId: 'app-1',
        },
      ),
    ).rejects.toThrow('database offline');
  });

  it('never dispatches when the admission transaction fails', async () => {
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
    const { service, ephemeral, execution, events } = createService({
      events: { enqueueRun: jest.fn().mockRejectedValue('event failed') },
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
        { targetDeviceId: 'app-1' },
      ),
    ).rejects.toBe('event failed');
    expect(events.transitionRun).not.toHaveBeenCalled();
    expect(execution.execute).not.toHaveBeenCalled();
    expect(ephemeral.delete).toHaveBeenCalledWith(runnable.entity.id);
  });

  it('guards cancellation and returns terminal runs unchanged', async () => {
    const canceled = {
      ...run,
      status: AutomationRunStatus.Canceled,
      completedAt: new Date(),
    };
    const transition = jest.fn().mockResolvedValue(canceled);
    const findMetadataByOwnerAndId = jest
      .fn()
      .mockResolvedValueOnce(run)
      .mockResolvedValueOnce(canceled);
    const { service, events } = createService({
      runs: { findMetadataByOwnerAndId },
      events: { transitionRun: transition },
    });

    await expect(service.cancel('owner-1', 'run-1')).resolves.toBe(canceled);
    expect(events.transitionRun).toHaveBeenCalledWith(
      run.id,
      expect.objectContaining({ status: AutomationRunStatus.Canceled }),
    );

    await expect(service.cancel('owner-1', 'run-1')).resolves.toBe(canceled);
    expect(transition).toHaveBeenCalledTimes(1);
  });

  it('drains admitted target work before cancellation and retries a failed cancellation write', async () => {
    const automation = {
      ...run,
      definitionJson: JSON.stringify({ spec: { steps: [] } }),
    } as never;
    const queued = { ...run, status: AutomationRunStatus.Queued };
    let reserved: typeof queued | undefined;
    const startEntered = deferred();
    const startResponse = deferred();
    const abortReceived = deferred();
    const transition = jest
      .fn()
      .mockRejectedValueOnce(new Error('SQLite write failed'))
      .mockImplementation(() => {
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
        await input.admitTargetWork(() => {
          startEntered.resolve();
          return startResponse.promise;
        });
      },
    );
    const { service } = createService({
      runs: { findMetadataByOwnerAndId: jest.fn(() => reserved) },
      events: {
        transitionRun: transition,
        enqueueRun: jest.fn(() => {
          if (reserved) throw activeTargetConflict;
          reserved = queued;
          return queued;
        }),
      },
      execution: { execute },
    });
    const enqueue = () =>
      service.enqueue(automation, AutomationRunTrigger.Manual, {
        targetDeviceId: queued.targetDeviceId,
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
    expect(transition).toHaveBeenCalledTimes(2);
  });

  it('recovers cancellation after the request fails without another Cancel request', async () => {
    const error = new Error('SQLite write failed');
    const recovered = deferred();
    const canceled = { ...run, status: AutomationRunStatus.Canceled };
    const transitionRun = jest
      .fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockImplementation(async () => {
        recovered.resolve();
        return canceled;
      });
    const { service } = createService({
      runs: { findMetadataByOwnerAndId: jest.fn().mockResolvedValue(run) },
      events: { transitionRun },
    });

    try {
      const request = service.cancel(run.ownerUserId, run.id);
      const concurrent = service.cancel(run.ownerUserId, run.id);
      await Promise.all([
        expect(request).rejects.toBe(error),
        expect(concurrent).rejects.toBe(error),
      ]);
      expect(transitionRun).toHaveBeenCalledTimes(3);

      await recovered.promise;
      expect(transitionRun).toHaveBeenCalledTimes(4);
      expect(transitionRun).toHaveBeenLastCalledWith(
        run.id,
        expect.objectContaining({ status: AutomationRunStatus.Canceled }),
      );
    } finally {
      service.onModuleDestroy();
    }
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
        findMetadataByOwnerAndId: jest.fn().mockResolvedValue(queued),
      },
      events: {
        transitionRun: jest.fn(async () => {
          cancelEntered.resolve();
          await cancelFinished.promise;
          return { ...queued, status: AutomationRunStatus.Canceled };
        }),
        enqueueRun: jest.fn(async () => {
          queuedEventEntered.resolve();
          await queuedEventFinished.promise;
          return queued;
        }),
      },
    });
    const enqueued = service.enqueue(automation, AutomationRunTrigger.Manual, {
      targetDeviceId: queued.targetDeviceId,
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
      runs: { findMetadataByOwnerAndId: jest.fn().mockResolvedValue(null) },
    });
    await expect(missing.service.cancel('owner-1', 'missing')).rejects.toThrow(
      'was not found',
    );

    const findMetadataByOwnerAndId = jest
      .fn()
      .mockResolvedValueOnce(run)
      .mockResolvedValueOnce(null);
    const raced = createService({
      runs: { findMetadataByOwnerAndId },
      events: { transitionRun: jest.fn().mockResolvedValue(null) },
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
      events: { enqueueRun: jest.fn().mockResolvedValue(queued) },
      ephemeral: { create: jest.fn().mockReturnValue(runnable) },
      execution: { execute: jest.fn().mockRejectedValue('dispatch failed') },
    });

    await service.enqueueEphemeral(
      'owner-1',
      definition,
      AutomationRunTrigger.Manual,
      { targetDeviceId: 'app-1' },
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
      },
      events: { transitionRun: transition },
    });

    await service.onApplicationBootstrap();

    expect(events.transitionRun).toHaveBeenCalledWith(
      run.id,
      expect.objectContaining({ status: AutomationRunStatus.Failed }),
    );
  });
});
