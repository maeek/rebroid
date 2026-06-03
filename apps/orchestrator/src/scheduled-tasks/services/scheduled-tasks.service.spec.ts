import { BadRequestException } from '@nestjs/common';
import {
  ScheduledTask,
  ScheduledTaskActionType,
  ScheduledTaskKind,
  ScheduledTaskLastStatus,
} from '../entities/scheduled-task.entity';
import { ScheduledTasksRepository } from '../persistence/scheduled-tasks.repository';
import { ScheduledTaskActionsService } from './scheduled-task-actions.service';
import { ScheduledTaskCronRegistryService } from './scheduled-task-cron-registry.service';
import { ScheduledTaskPredefinedSeederService } from './scheduled-task-predefined-seeder.service';
import { ScheduledTaskRunnerService } from './scheduled-task-runner.service';
import { ScheduledTaskScheduleService } from './scheduled-task-schedule.service';
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
  cron = {},
  actions = {},
  seeder = {},
  runner = {},
  schedule = {},
}: {
  repository?: Partial<ScheduledTasksRepository>;
  cron?: Partial<ScheduledTaskCronRegistryService>;
  actions?: Partial<ScheduledTaskActionsService>;
  seeder?: Partial<ScheduledTaskPredefinedSeederService>;
  runner?: Partial<ScheduledTaskRunnerService>;
  schedule?: Partial<ScheduledTaskScheduleService>;
} = {}) => {
  const tasks = {
    create: jest.fn((value: Partial<ScheduledTask>) => task(value)),
    save: jest.fn(async (value: ScheduledTask) => value),
    findAll: jest.fn(async () => []),
    listForDisplay: jest.fn(async () => []),
    findById: jest.fn(async () => task()),
    findByPredefinedKeys: jest.fn(async () => []),
    remove: jest.fn(async (value: ScheduledTask) => value),
    ...repository,
  } as unknown as ScheduledTasksRepository;
  const taskActions = {
    listActions: jest.fn(() => []),
    normalizePayload: jest.fn((_type, payload) => payload ?? null),
    run: jest.fn(async () => ({})),
    ...actions,
  } as unknown as ScheduledTaskActionsService;
  const cronRegistry = {
    registerTask: jest.fn(),
    unregisterTask: jest.fn(),
    ...cron,
  } as unknown as ScheduledTaskCronRegistryService;
  const predefinedSeeder = {
    ensurePredefinedTasks: jest.fn(async () => undefined),
    ...seeder,
  } as unknown as ScheduledTaskPredefinedSeederService;
  const taskRunner = {
    runTask: jest.fn(async () => undefined),
    parsePayload: jest.fn(
      (scheduledTask: Pick<ScheduledTask, 'payloadJson'>) =>
        scheduledTask.payloadJson
          ? (JSON.parse(scheduledTask.payloadJson) as Record<string, unknown>)
          : null,
    ),
    ...runner,
  } as unknown as ScheduledTaskRunnerService;
  const taskSchedule = {
    validateCronExpression: jest.fn((value: string) => {
      if (value === 'not cron') {
        throw new BadRequestException('Invalid cron expression.');
      }
      return value.trim();
    }),
    nextRun: jest.fn(() => new Date('2026-01-02T00:00:00.000Z')),
    ...schedule,
  } as unknown as ScheduledTaskScheduleService;

  return {
    service: new ScheduledTasksService(
      tasks,
      taskActions,
      cronRegistry,
      predefinedSeeder,
      taskRunner,
      taskSchedule,
    ),
    tasks,
    taskActions,
    cronRegistry,
    predefinedSeeder,
    taskRunner,
    taskSchedule,
  };
};

describe('ScheduledTasksService', () => {
  it('creates an enabled cron task and registers it', async () => {
    const { service, tasks, cronRegistry, taskActions } = createService();

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
    expect(cronRegistry.registerTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-1' }),
      expect.any(Function),
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
    const { service, predefinedSeeder } = createService();

    await service.onModuleInit();

    expect(predefinedSeeder.ensurePredefinedTasks).toHaveBeenCalled();
  });

  it('does not delete predefined tasks', async () => {
    const existing = task({
      kind: ScheduledTaskKind.Predefined,
      predefinedKey: 'prune-docker-images',
    });
    const { service } = createService({
      repository: {
        findById: jest.fn(async () => existing),
      },
    });

    await expect(service.remove(existing.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('records run-now failures on the task', async () => {
    const existing = task();
    const { service, taskRunner } = createService({
      repository: {
        findById: jest.fn(async () => existing),
      },
      runner: {
        runTask: jest.fn(async () => {
          existing.lastStatus = ScheduledTaskLastStatus.Failed;
          existing.lastError = 'cleanup failed';
        }),
      },
    });

    await expect(service.runNow(existing.id)).resolves.toMatchObject({
      lastStatus: ScheduledTaskLastStatus.Failed,
      lastError: 'cleanup failed',
    });

    expect(taskRunner.runTask).toHaveBeenCalledWith(existing.id);
  });
});
