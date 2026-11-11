import { DataSource } from 'typeorm';
import {
  ScheduledTask,
  ScheduledTaskActionType,
  ScheduledTaskKind,
  ScheduledTaskLastStatus,
} from '../entities/scheduled-task.entity';
import { ScheduledTasksRepository } from '../persistence/scheduled-tasks.repository';
import { ScheduledTaskActionsService } from './scheduled-task-actions.service';
import { ScheduledTaskCronRegistryService } from './scheduled-task-cron-registry.service';
import { ScheduledTaskRunnerService } from './scheduled-task-runner.service';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('scheduled task execution reservation', () => {
  let database: DataSource;
  let tasks: ScheduledTasksRepository;
  let runner: ScheduledTaskRunnerService;
  const run = jest.fn();
  const unregisterTask = jest.fn();

  beforeEach(async () => {
    database = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [ScheduledTask],
      synchronize: true,
    }).initialize();
    tasks = new ScheduledTasksRepository(database.getRepository(ScheduledTask));
    runner = new ScheduledTaskRunnerService(
      tasks,
      { run } as unknown as ScheduledTaskActionsService,
      { unregisterTask } as unknown as ScheduledTaskCronRegistryService,
    );
    run.mockReset().mockResolvedValue(undefined);
    unregisterTask.mockReset();
    await tasks.save(
      tasks.create({
        id: 'task-1',
        name: 'Cleanup',
        kind: ScheduledTaskKind.Custom,
        enabled: true,
        cronExpression: '0 3 * * *',
        actionType: ScheduledTaskActionType.CleanUploadedApks,
        payloadJson: null,
      }),
    );
  });

  afterEach(async () => {
    await database.destroy();
  });

  it('admits only one simultaneous cron or manual invocation', async () => {
    const completion = deferred();
    run.mockReturnValue(completion.promise);
    const first = runner.runTask('task-1');
    const second = runner.runTask('task-1', 'cron');
    completion.resolve();
    await Promise.all([first, second]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('retains edits made during execution and schedules from current settings', async () => {
    run.mockImplementation(async () => {
      const current = (await tasks.findById('task-1'))!;
      await tasks.updateConfiguration({
        ...current,
        name: 'Updated',
        enabled: false,
        nextRunAt: null,
        cronExpression: '0 4 * * *',
      });
    });
    await runner.runTask('task-1');
    expect(await tasks.findById('task-1')).toMatchObject({
      name: 'Updated',
      enabled: false,
      cronExpression: '0 4 * * *',
      nextRunAt: null,
      lastStatus: ScheduledTaskLastStatus.Success,
    });
  });

  it('does not recreate a task removed during execution', async () => {
    run.mockImplementation(async () => {
      await tasks.remove((await tasks.findById('task-1'))!);
    });
    await runner.runTask('task-1');
    expect(await tasks.findById('task-1')).toBeNull();
  });

  it('releases the reservation after completion persistence fails', async () => {
    jest
      .spyOn(tasks, 'recordRunResult')
      .mockRejectedValueOnce(new Error('disk full'));
    await expect(runner.runTask('task-1')).rejects.toThrow('disk full');
    await runner.runTask('task-1');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('keeps a newer schedule when a stale next-run write arrives', async () => {
    const original = (await tasks.findById('task-1'))!;
    const nextRunAt = new Date('2030-01-01T00:00:00Z');
    await tasks.updateConfiguration({
      ...original,
      enabled: false,
      nextRunAt: null,
    });
    await tasks.updateNextRun(original, nextRunAt);
    expect(await tasks.findById('task-1')).toMatchObject({
      enabled: false,
      nextRunAt: null,
    });
  });

  it('skips a queued cron callback after disabling but still allows Run now', async () => {
    const task = (await tasks.findById('task-1'))!;
    await tasks.updateConfiguration({
      ...task,
      enabled: false,
      nextRunAt: null,
    });
    await runner.runTask(task.id, 'cron');
    expect(run).not.toHaveBeenCalled();
    await runner.runTask(task.id);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
