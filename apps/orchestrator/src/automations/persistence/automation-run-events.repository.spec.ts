import { InitializeSqliteSchema1800000005000 } from '../../database/migrations/1800000005000-initialize-sqlite-schema';
import { DataSource } from 'typeorm';
import { MetricsService } from '../../metrics/metrics.service';
import {
  AutomationRun,
  AutomationRunStatus,
  AutomationRunTrigger,
} from '../entities/automation-run.entity';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import type { AutomationStepResult } from '../runner/automation-runner.types';
import { AutomationPersistenceQueue } from './automation-persistence-queue';
import { AutomationRunsRepository } from './automation-runs.repository';
import { AutomationRunEvent } from '../entities/automation-run-event.entity';
import { AutomationRunEventsRepository } from './automation-run-events.repository';

it('projects the original prompt and terminal outcome past the first event page', async () => {
  const database = await new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: [AutomationRunEvent],
    migrations: [InitializeSqliteSchema1800000005000],
    migrationsRun: true,
  }).initialize();
  try {
    const events = database.getRepository(AutomationRunEvent);
    const base = {
      runId: 'run',
      ownerUserId: 'owner',
      dataJson: '{}',
      message: 'fixture',
    };
    const rows = [
      { ...base, sequence: 1, type: 'ai.user.message' },
      ...Array.from({ length: 1_050 }, (_, index) => ({
        ...base,
        sequence: index + 2,
        type: 'ai.action.decided',
      })),
      { ...base, sequence: 1_052, type: 'ai.message.completed' },
      { ...base, sequence: 1_053, type: 'run.completed' },
      {
        ...base,
        runId: 'other',
        ownerUserId: 'different',
        sequence: 1,
        type: 'ai.user.message',
      },
    ];
    for (let index = 0; index < rows.length; index += 200) {
      await events.insert(rows.slice(index, index + 200));
    }
    const repository = new AutomationRunEventsRepository(
      events,
      database,
      {} as never,
    );
    const history = await repository.listConversationEvents('owner', [
      'run',
      'other',
    ]);
    expect(history[0]).toMatchObject({ sequence: 1, type: 'ai.user.message' });
    expect(history.slice(-2).map((event) => event.type)).toEqual([
      'ai.message.completed',
      'run.completed',
    ]);
    expect(history).toHaveLength(81);
    expect(history.every((event) => event.ownerUserId === 'owner')).toBe(true);
  } finally {
    await database.destroy();
  }
});

const createRunPersistence = async () => {
  const db = await new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: [AutomationRun, AutomationRunEvent],
    migrations: [InitializeSqliteSchema1800000005000],
    migrationsRun: true,
  }).initialize();
  const queue = new AutomationPersistenceQueue();
  const runs = new AutomationRunsRepository(
    db.getRepository(AutomationRun),
    queue,
  );
  const events = new AutomationRunEventsRepository(
    db.getRepository(AutomationRunEvent),
    db,
    new MetricsService(),
    queue,
  );
  const run = await runs.save(
    runs.create({
      ownerUserId: 'owner',
      targetApplicationId: 'app',
      automationId: 'workflow',
      trigger: AutomationRunTrigger.Manual,
      status: AutomationRunStatus.Running,
    }),
  );
  return { db, runs, events, run };
};

it('rolls back a terminal status and sequence when event insertion fails, then publishes only the committed winner', async () => {
  const { db, runs, events, run } = await createRunPersistence();
  try {
    const bus = new AutomationRunEventBus(events);
    const received = jest.fn();
    bus.subscribe(run.id, () => {
      throw new Error('subscriber failed');
    });
    bus.subscribe(run.id, received);
    const finish = (
      status: AutomationRunStatus.Success | AutomationRunStatus.Canceled,
    ) =>
      bus.transitionRun(
        run.id,
        [AutomationRunStatus.Running],
        { status, completedAt: new Date(), error: null },
        {
          type:
            status === AutomationRunStatus.Success
              ? 'run.completed'
              : 'run.canceled',
        },
      );
    await db.query(`CREATE TRIGGER reject_event BEFORE INSERT ON automation_run_events
      BEGIN SELECT RAISE(ABORT, 'fixture rejected event'); END`);
    await expect(finish(AutomationRunStatus.Success)).rejects.toThrow(
      'fixture rejected event',
    );
    await expect(runs.findById(run.id)).resolves.toMatchObject({
      status: AutomationRunStatus.Running,
      lastEventSequence: 0,
    });
    expect(received).not.toHaveBeenCalled();
    await db.query('DROP TRIGGER reject_event');

    const [winner, loser] = await Promise.all([
      finish(AutomationRunStatus.Canceled),
      finish(AutomationRunStatus.Success),
    ]);
    expect(winner).toMatchObject({
      status: AutomationRunStatus.Canceled,
      lastEventSequence: 1,
    });
    expect(loser).toBeNull();
    const replay = await events.listForRun('owner', run.id);
    expect(replay).toMatchObject([{ type: 'run.canceled', sequence: 1 }]);
    expect(received).toHaveBeenCalledTimes(1);
    expect(received).toHaveBeenCalledWith(replay[0]);
  } finally {
    await db.destroy();
  }
});

it('projects ordered step results through the run and fences writes after cancellation', async () => {
  const { db, runs, events, run } = await createRunPersistence();
  try {
    const result = (stepId: string): AutomationStepResult => ({
      stepId,
      uses: 'android.wait',
      status: 'success',
      startedAt: '2026-11-11T00:00:00.000Z',
      completedAt: '2026-11-11T00:00:01.000Z',
      output: { stepId },
      error: null,
    });
    expect(run.stepResultsJson).toBe('[]');
    const first = result('first');
    const second = result('second');
    await expect(runs.findById(run.id)).resolves.toMatchObject({
      stepResultsJson: '[]',
    });
    await expect(
      runs.appendStepResults(run.id, 1, [first], null),
    ).resolves.toBe(true);
    await expect(
      runs.appendStepResults(run.id, 2, [second], null),
    ).resolves.toBe(true);
    const canceled = await events.transitionRun(
      run.id,
      [AutomationRunStatus.Running],
      {
        status: AutomationRunStatus.Canceled,
        completedAt: new Date(),
        error: 'Canceled by user.',
      },
      { type: 'run.canceled' },
    );
    await expect(
      runs.appendStepResults(run.id, 3, [result('late')], null),
    ).resolves.toBe(false);
    const history = await runs.findByOwnerAndId(run.ownerUserId, run.id);
    expect(JSON.parse(history?.stepResultsJson ?? 'null')).toEqual([
      first,
      second,
    ]);
    expect(JSON.parse(canceled?.run.stepResultsJson ?? 'null')).toEqual([
      first,
      second,
    ]);
    await runs.deleteByIds(run.ownerUserId, [run.id]);
    expect(await db.query('SELECT * FROM automation_run_step_results')).toEqual(
      [],
    );
  } finally {
    await db.destroy();
  }
});
