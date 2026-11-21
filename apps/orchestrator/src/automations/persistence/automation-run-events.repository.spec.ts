import { InitializeSqliteSchema1800000005000 } from '../../database/migrations/1800000005000-initialize-sqlite-schema';
import { SerializedSqliteDataSource } from '../../database/serialized-sqlite-data-source';
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
import {
  AutomationRunEventsRepository,
  AutomationRunTargetConflictError,
} from './automation-run-events.repository';

it('projects the original prompt and terminal outcome past the first event page', async () => {
  const database = await new SerializedSqliteDataSource({
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

const createRunPersistence = async (status = AutomationRunStatus.Running) => {
  const db = await new SerializedSqliteDataSource({
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
  const run = await db.getRepository(AutomationRun).save({
    ownerUserId: 'owner',
    targetApplicationId: 'app',
    automationId: 'workflow',
    trigger: AutomationRunTrigger.Manual,
    status,
  });
  return { db, runs, events, run };
};

it('translates a duplicate target reservation and preserves event constraint failures', async () => {
  const { db, events, run } = await createRunPersistence();
  try {
    const input = {
      automationId: run.automationId,
      automationTriggerId: null,
      ownerUserId: run.ownerUserId,
      targetApplicationId: run.targetApplicationId,
      targetProfileMode: null,
      targetProfileName: null,
      trigger: run.trigger,
    };
    await expect(events.enqueueRun(input)).rejects.toBeInstanceOf(
      AutomationRunTargetConflictError,
    );

    await db.query(`CREATE TRIGGER duplicate_event_sequence AFTER INSERT ON automation_run_events
      WHEN NEW.type = 'run.queued' BEGIN
        INSERT INTO automation_run_events (id, runId, ownerUserId, sequence, type, message, dataJson)
        VALUES ('fixture', NEW.runId, NEW.ownerUserId, NEW.sequence, 'run.queued', '', '{}');
      END`);
    await expect(
      events.enqueueRun({ ...input, targetApplicationId: 'available' }),
    ).rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT_UNIQUE' });
    await expect(
      db.query(
        "SELECT id FROM automation_runs WHERE targetApplicationId = 'available'",
      ),
    ).resolves.toEqual([]);
  } finally {
    await db.destroy();
  }
});

it('rolls back admission when its prompt cannot be written and commits the initial history together', async () => {
  const { db, events, run } = await createRunPersistence();
  try {
    const bus = new AutomationRunEventBus(events);
    const input = {
      automationId: run.automationId,
      automationTriggerId: null,
      ownerUserId: run.ownerUserId,
      targetApplicationId: 'another-app',
      targetProfileMode: null,
      targetProfileName: null,
      trigger: AutomationRunTrigger.Manual,
    };
    const prompt = { prompt: 'Open settings', clientMessageId: 'turn-1' };
    await db.query(`CREATE TRIGGER reject_prompt BEFORE INSERT ON automation_run_events
      WHEN NEW.type = 'ai.user.message' BEGIN SELECT RAISE(ABORT, 'fixture rejected prompt'); END`);
    await expect(bus.enqueueRun(input, prompt)).rejects.toThrow(
      'fixture rejected prompt',
    );
    expect(
      await db.query(
        'SELECT id FROM automation_runs WHERE targetApplicationId = ?',
        [input.targetApplicationId],
      ),
    ).toEqual([]);
    expect(await db.query('SELECT type FROM automation_run_events')).toEqual(
      [],
    );
    await db.query('DROP TRIGGER reject_prompt');

    const queued = await bus.enqueueRun(input, prompt);
    expect(queued).toMatchObject({
      status: AutomationRunStatus.Queued,
      lastEventSequence: 2,
    });
    await bus.transitionRun(queued.id, {
      status: AutomationRunStatus.Canceled,
      completedAt: new Date(),
      error: 'Canceled by user.',
    });
    await expect(
      bus.listPage(queued.ownerUserId, queued.id, 0),
    ).resolves.toMatchObject({
      events: [
        { type: 'run.queued', sequence: 1 },
        {
          type: 'ai.user.message',
          sequence: 2,
          message: prompt.prompt,
          data: { clientMessageId: prompt.clientMessageId },
        },
        { type: 'run.canceled', sequence: 3 },
      ],
    });
  } finally {
    await db.destroy();
  }
});

it('publishes step admission only while the owning run is active', async () => {
  const { db, events, run } = await createRunPersistence();
  try {
    const bus = new AutomationRunEventBus(events);
    const event = {
      runId: run.id,
      ownerUserId: run.ownerUserId,
      type: 'step.started' as const,
    };
    const received = jest.fn();
    bus.subscribe(run.id, received);
    await expect(
      bus.emitWhileRunning({ ...event, ownerUserId: 'another-user' }),
    ).resolves.toBe(false);
    await expect(bus.emitWhileRunning(event)).resolves.toBe(true);
    await bus.transitionRun(run.id, {
      status: AutomationRunStatus.Canceled,
      completedAt: new Date(),
      error: null,
    });
    await expect(bus.emitWhileRunning(event)).resolves.toBe(false);
    expect(received.mock.calls.map(([item]) => item.type)).toEqual([
      'step.started',
      'run.canceled',
    ]);
  } finally {
    await db.destroy();
  }
});

it('publishes preparation only while the owning run remains queued', async () => {
  const { db, events, run } = await createRunPersistence(
    AutomationRunStatus.Queued,
  );
  try {
    const bus = new AutomationRunEventBus(events);
    const received = jest.fn();
    bus.subscribe(run.id, received);
    const progress = {
      runId: run.id,
      ownerUserId: run.ownerUserId,
      type: 'run.preparing' as const,
    };
    await bus.emitWhileQueued({ ...progress, ownerUserId: 'another-owner' });
    await bus.emitWhileQueued(progress);
    await bus.transitionRun(run.id, {
      status: AutomationRunStatus.Canceled,
      completedAt: new Date(),
      error: null,
    });
    await bus.emitWhileQueued(progress);

    expect(
      received.mock.calls.map(([event]) => [event.type, event.sequence]),
    ).toEqual([
      ['run.preparing', 1],
      ['run.canceled', 2],
    ]);
  } finally {
    await db.destroy();
  }
});

it('publishes workflow history after an unrelated SQLite rollback and preserves ordinary writes', async () => {
  const { db, events, run } = await createRunPersistence();
  let resume!: () => void;
  let entered!: () => void;
  const held = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  try {
    await db.query('CREATE TABLE lifecycle_fixture (state TEXT NOT NULL)');
    const transaction = db.transaction(async (manager) => {
      await manager.query("INSERT INTO lifecycle_fixture VALUES ('rollback')");
      entered();
      await held;
      throw new Error('lifecycle failed');
    });
    const rolledBack = expect(transaction).rejects.toThrow('lifecycle failed');
    await started;

    const bus = new AutomationRunEventBus(events);
    const received = jest.fn();
    bus.subscribe(run.id, received);
    const event = bus.emitWhileRunning({
      runId: run.id,
      ownerUserId: run.ownerUserId,
      type: 'step.started',
    });
    const ordinary = db.query(
      "INSERT INTO lifecycle_fixture VALUES ('committed')",
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(received).not.toHaveBeenCalled();

    resume();
    await rolledBack;
    await expect(event).resolves.toBe(true);
    await ordinary;
    expect(received).toHaveBeenCalledTimes(1);
    expect(
      await events.listReplayPage(
        run.ownerUserId,
        run.id,
        0,
        Number.MAX_SAFE_INTEGER,
      ),
    ).toMatchObject([{ sequence: 1 }]);
    expect(await db.query('SELECT state FROM lifecycle_fixture')).toEqual([
      { state: 'committed' },
    ]);
  } finally {
    resume();
    await db.destroy();
  }
});

it('commits the start event with the runtime profile and rolls both back on failure', async () => {
  const { db, runs, events, run } = await createRunPersistence(
    AutomationRunStatus.Queued,
  );
  try {
    const bus = new AutomationRunEventBus(events);
    const received = jest.fn();
    bus.subscribe(run.id, received);
    const startedAt = new Date();
    const start = () =>
      bus.transitionRun(run.id, {
        status: AutomationRunStatus.Running,
        startedAt,
        targetProfileMode: 'persistent',
        targetProfileName: 'default',
        error: null,
      });
    await db.query(`CREATE TRIGGER reject_event BEFORE INSERT ON automation_run_events
      BEGIN SELECT RAISE(ABORT, 'fixture rejected event'); END`);
    await expect(start()).rejects.toThrow('fixture rejected event');
    await expect(runs.findById(run.id)).resolves.toMatchObject({
      status: AutomationRunStatus.Queued,
      startedAt: null,
      targetProfileName: null,
      lastEventSequence: 0,
    });
    expect(received).not.toHaveBeenCalled();
    await db.query('DROP TRIGGER reject_event');

    const [started, canceled] = await Promise.all([
      start(),
      bus.transitionRun(run.id, {
        status: AutomationRunStatus.Canceled,
        completedAt: new Date(),
        error: 'Canceled by user.',
      }),
    ]);
    expect(started).toMatchObject({
      status: AutomationRunStatus.Running,
      startedAt,
      targetProfileName: 'default',
      lastEventSequence: 1,
    });
    expect(canceled).toMatchObject({
      status: AutomationRunStatus.Canceled,
      lastEventSequence: 2,
    });
    await expect(start()).resolves.toBeNull();
    expect(received.mock.calls.map(([event]) => event)).toMatchObject([
      { type: 'run.started', sequence: 1 },
      { type: 'run.canceled', sequence: 2 },
    ]);
  } finally {
    await db.destroy();
  }
});

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
      bus.transitionRun(run.id, {
        status,
        completedAt: new Date(),
        error: null,
      });
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
    const replay = await events.listReplayPage(
      'owner',
      run.id,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    expect(replay).toMatchObject([{ type: 'run.canceled', sequence: 1 }]);
    expect(received).toHaveBeenCalledTimes(1);
    expect(received).toHaveBeenCalledWith(replay[0]);
  } finally {
    await db.destroy();
  }
});

it('reads the failure code and request ID from the owner’s terminal event', async () => {
  const { db, events, run } = await createRunPersistence();
  try {
    await events.transitionRun(
      run.id,
      {
        status: AutomationRunStatus.Failed,
        error: 'Unavailable',
        completedAt: new Date(),
      },
      {
        code: 'authorization_unreachable',
        requestId: 'authorization-request-1',
      },
    );
    await expect(
      events.findFailureDetails(run.ownerUserId, run.id),
    ).resolves.toEqual({
      failureCode: 'authorization_unreachable',
      failureRequestId: 'authorization-request-1',
    });
    await expect(events.findFailureDetails('other', run.id)).resolves.toEqual(
      {},
    );
  } finally {
    await db.destroy();
  }
});

it('bounds HTTP history and WebSocket replay by payload bytes', async () => {
  const { db, events, run } = await createRunPersistence();
  try {
    const append = (text: string) =>
      events.appendWhileRunning({
        runId: run.id,
        ownerUserId: run.ownerUserId,
        type: 'step.progress',
        data: { text },
      });
    await append('é'.repeat(300_000));
    await append('é'.repeat(300_000));
    await append('x'.repeat(1_100_000));
    await append('arrived after replay began');

    const replay = (after: number) =>
      events.listReplayPage(run.ownerUserId, run.id, after, 3);
    await expect(replay(0)).resolves.toMatchObject([{ sequence: 1 }]);
    await expect(replay(1)).resolves.toMatchObject([{ sequence: 2 }]);
    await expect(replay(2)).resolves.toMatchObject([{ sequence: 3 }]);
    await expect(replay(3)).resolves.toEqual([]);
    await expect(
      events.listReplayPage('other-owner', run.id, 0, 3),
    ).resolves.toEqual([]);

    const bus = new AutomationRunEventBus(events);
    const history = (after: number) =>
      bus.listPage(run.ownerUserId, run.id, after);
    await expect(history(0)).resolves.toMatchObject({
      events: [{ sequence: 1 }],
      nextAfter: 1,
    });
    await expect(history(1)).resolves.toMatchObject({
      events: [{ sequence: 2 }],
      nextAfter: 2,
    });
    await expect(history(2)).resolves.toMatchObject({
      events: [{ sequence: 3 }],
      nextAfter: 3,
    });
    await expect(history(3)).resolves.toMatchObject({
      events: [{ sequence: 4 }],
      nextAfter: null,
    });
    await expect(history(4)).resolves.toEqual({ events: [], nextAfter: null });
    await expect(bus.listPage('other-owner', run.id, 0)).resolves.toEqual({
      events: [],
      nextAfter: null,
    });
  } finally {
    await db.destroy();
  }
});

it('projects ordered step results through the run and fences writes after cancellation', async () => {
  const { db, runs, events, run } = await createRunPersistence();
  try {
    const bus = new AutomationRunEventBus(events);
    const received = jest.fn();
    bus.subscribe(run.id, received);
    const result = (stepId: string): AutomationStepResult => ({
      stepId,
      uses: 'android.wait',
      status: 'success',
      startedAt: '2026-11-11T00:00:00.000Z',
      completedAt: '2026-11-11T00:00:01.000Z',
      output: { stepId },
      error: null,
    });
    const record = (outcome: AutomationStepResult) =>
      bus.recordStepOutcome(
        {
          runId: run.id,
          ownerUserId: run.ownerUserId,
          stepId: outcome.stepId,
          type: 'step.completed',
        },
        outcome,
      );
    const first = result('first');
    const second = result('second');
    await expect(
      runs.findByOwnerAndId(run.ownerUserId, run.id),
    ).resolves.toMatchObject({
      stepResultsJson: '[]',
    });
    await db.query(`CREATE TRIGGER reject_event BEFORE INSERT ON automation_run_events
      BEGIN SELECT RAISE(ABORT, 'fixture rejected event'); END`);
    await expect(record(first)).rejects.toThrow('fixture rejected event');
    expect(await db.query('SELECT * FROM automation_run_step_results')).toEqual(
      [],
    );
    expect(received).not.toHaveBeenCalled();
    await db.query('DROP TRIGGER reject_event');
    await expect(record(first)).resolves.toBe(true);
    await expect(record(second)).resolves.toBe(true);
    const canceled = await events.transitionRun(run.id, {
      status: AutomationRunStatus.Canceled,
      completedAt: new Date(),
      error: 'Canceled by user.',
    });
    await expect(record(result('late'))).resolves.toBe(false);
    expect(received.mock.calls.map(([event]) => event)).toMatchObject([
      { sequence: 1, type: 'step.completed', stepId: 'first' },
      { sequence: 2, type: 'step.completed', stepId: 'second' },
    ]);
    const history = await runs.findByOwnerAndId(run.ownerUserId, run.id);
    expect(JSON.parse(history?.stepResultsJson ?? 'null')).toEqual([
      first,
      second,
    ]);
    expect(canceled?.run.status).toBe(AutomationRunStatus.Canceled);
    expect(canceled?.run.stepResultsJson).toBeUndefined();
    expect((await runs.findById(run.id))?.stepResultsJson).toBeUndefined();
    await expect(runs.existsForOwner(run.ownerUserId, run.id)).resolves.toBe(
      true,
    );
    await expect(runs.existsForOwner('other-owner', run.id)).resolves.toBe(
      false,
    );
    await runs.deleteByIds(run.ownerUserId, [run.id]);
    expect(await db.query('SELECT * FROM automation_run_step_results')).toEqual(
      [],
    );
  } finally {
    await db.destroy();
  }
});
