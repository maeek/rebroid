import { BadRequestException } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import {
  ScheduledTask,
  ScheduledTaskActionType,
  ScheduledTaskKind,
  ScheduledTaskLastStatus,
} from '../entities/scheduled-task.entity';
import { ScheduledTaskActionsService } from './scheduled-task-actions.service';
import { ScheduledTasksService } from './scheduled-tasks.service';

const task = (patch: Partial<ScheduledTask> = {}): ScheduledTask => ({
  id: 'task-1',
  name: 'Nightly cleanup',
  enabled: true,
  kind: ScheduledTaskKind.Custom,
  predefinedKey: null,
  cronExpression: '0 3 * * *',
  actionType: ScheduledTaskActionType.CleanUploadedApks,
  payloadJson: null,
  lastRunAt: null,
  nextRunAt: null,
  lastStatus: ScheduledTaskLastStatus.NeverRun,
  lastError: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...patch,
});

const createService = ({
  repository = {},
  scheduler = {},
  actions = {},
}: {
  repository?: Partial<Repository<ScheduledTask>>;
  scheduler?: Partial<SchedulerRegistry>;
  actions?: Partial<ScheduledTaskActionsService>;
} = {}) => {
  const tasks = {
    create: jest.fn((value: Partial<ScheduledTask>) => task(value)),
    save: jest.fn(async (value: ScheduledTask) => value),
    find: jest.fn(async () => []),
    findOneBy: jest.fn(async () => task()),
    remove: jest.fn(async (value: ScheduledTask) => value),
    ...repository,
  } as unknown as Repository<ScheduledTask>;
  const registry = {
    addCronJob: jest.fn(
      (_name: string, job: { start: () => void; stop: () => void }) => {
        job.stop();
        job.start = jest.fn();
      },
    ),
    deleteCronJob: jest.fn(() => {
      throw new Error('missing job');
    }),
    ...scheduler,
  } as unknown as SchedulerRegistry;
  const taskActions = {
    listActions: jest.fn(() => []),
    normalizePayload: jest.fn((_type, payload) => payload ?? null),
    run: jest.fn(async () => ({})),
    ...actions,
  } as unknown as ScheduledTaskActionsService;

  return {
    service: new ScheduledTasksService(tasks, registry, taskActions),
    tasks,
    registry,
    taskActions,
  };
};

describe('ScheduledTasksService', () => {
  it('creates an enabled cron task and registers it', async () => {
    const { service, tasks, registry, taskActions } = createService();

    await expect(
      service.create({
        name: '  Nightly cleanup  ',
        enabled: true,
        cronExpression: '0 3 * * *',
        actionType: ScheduledTaskActionType.PruneImages,
        payload: { danglingOnly: false },
      }),
    ).resolves.toMatchObject({
      name: 'Nightly cleanup',
      enabled: true,
      actionType: ScheduledTaskActionType.PruneImages,
      payload: { danglingOnly: false },
      lastStatus: ScheduledTaskLastStatus.NeverRun,
    });

    expect(taskActions.normalizePayload).toHaveBeenCalledWith(
      ScheduledTaskActionType.PruneImages,
      { danglingOnly: false },
    );
    expect(tasks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: ScheduledTaskKind.Custom,
        cronExpression: '0 3 * * *',
        nextRunAt: expect.any(Date),
      }),
    );
    expect(registry.addCronJob).toHaveBeenCalledWith(
      'scheduled-task:task-1',
      expect.any(Object),
    );
  });

  it('rejects invalid cron expressions', async () => {
    const { service } = createService();

    await expect(
      service.create({
        name: 'Broken cleanup',
        cronExpression: 'not cron',
        actionType: ScheduledTaskActionType.PruneAll,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('seeds predefined maintenance tasks on startup', async () => {
    const { service, tasks } = createService();

    await service.onModuleInit();

    expect(tasks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: ScheduledTaskKind.Predefined,
        predefinedKey: 'prune-docker-images',
        actionType: ScheduledTaskActionType.PruneImages,
        payloadJson: JSON.stringify({ danglingOnly: true }),
      }),
    );
    expect(tasks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: ScheduledTaskKind.Predefined,
        predefinedKey: 'clean-runtime-logs',
        actionType: ScheduledTaskActionType.CleanRuntimeLogs,
        payloadJson: JSON.stringify({ retentionDays: 30 }),
      }),
    );
  });

  it('does not delete predefined tasks', async () => {
    const existing = task({
      kind: ScheduledTaskKind.Predefined,
      predefinedKey: 'prune-docker-images',
    });
    const { service } = createService({
      repository: {
        findOneBy: jest.fn(async () => existing),
      },
    });

    await expect(service.remove(existing.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('records run-now failures on the task', async () => {
    const existing = task();
    const { service, tasks, taskActions } = createService({
      repository: {
        findOneBy: jest.fn(async () => existing),
      },
      actions: {
        run: jest.fn(async () => {
          throw new Error('cleanup failed');
        }),
      },
    });

    await expect(service.runNow(existing.id)).resolves.toMatchObject({
      lastStatus: ScheduledTaskLastStatus.Failed,
      lastError: 'cleanup failed',
    });

    expect(taskActions.run).toHaveBeenCalledWith(existing.actionType, null);
    expect(tasks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        lastStatus: ScheduledTaskLastStatus.Failed,
        lastError: 'cleanup failed',
        lastRunAt: expect.any(Date),
      }),
    );
  });
});
