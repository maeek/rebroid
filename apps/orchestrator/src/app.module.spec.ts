import { Test } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { AutomationRunEventsRepository } from './automations/persistence/automation-run-events.repository';
import { AutomationRunsRepository } from './automations/persistence/automation-runs.repository';
import { InitializeSqliteSchema1800000000000 } from './database/migrations/1800000000000-initialize-sqlite-schema';
import { WorkflowRunSummaries1800000001000 } from './database/migrations/1800000001000-workflow-run-summaries';
import { NetworkPolicyRevision1800000002000 } from './database/migrations/1800000002000-network-policy-revision';
import { ApplicationWorkflowHistory1800000003000 } from './database/migrations/1800000003000-application-workflow-history';
import {
  configureFastifyPlatform,
  createFastifyAdapter,
} from './platform/http-platform';

const envKeys = [
  'DATABASE_PATH',
  'DISPLAY_SIDECAR_AUTO_START',
  'FIREWALL_POLICY_BOOTSTRAP',
  'ORCHESTRATOR_SHARED_SECRET',
  'RUNTIME_LOGS_DIR',
  'SETTINGS_PATH',
  'UPLOADS_DIR',
] as const;

describe('AppModule', () => {
  let app: NestFastifyApplication | null = null;
  let temporaryDirectory: string;
  let previousEnv: Partial<Record<(typeof envKeys)[number], string>>;

  beforeEach(async () => {
    previousEnv = Object.fromEntries(
      envKeys.map((key) => [key, process.env[key]]),
    );
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'rebroid-app-'));
    process.env.DATABASE_PATH = join(temporaryDirectory, 'orchestrator.sqlite');
    process.env.SETTINGS_PATH = join(temporaryDirectory, 'settings.json');
    process.env.UPLOADS_DIR = join(temporaryDirectory, 'uploads');
    process.env.RUNTIME_LOGS_DIR = join(temporaryDirectory, 'logs');
    process.env.ORCHESTRATOR_SHARED_SECRET = 'test-secret';
    process.env.DISPLAY_SIDECAR_AUTO_START = 'false';
    process.env.FIREWALL_POLICY_BOOTSTRAP = 'false';
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    for (const key of envKeys) {
      const value = previousEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it('upgrades stored workflow results before recovering an interrupted run', async () => {
    const results = [{ stepId: 'first' }, { stepId: 'second' }];
    const legacy = await new DataSource({
      type: 'better-sqlite3',
      database: join(temporaryDirectory, 'orchestrator.sqlite'),
      migrations: [
        InitializeSqliteSchema1800000000000,
        WorkflowRunSummaries1800000001000,
        NetworkPolicyRevision1800000002000,
        ApplicationWorkflowHistory1800000003000,
      ],
      migrationsRun: true,
    }).initialize();
    try {
      await legacy.query(
        `INSERT INTO automation_runs
           (id, automationId, ownerUserId, targetApplicationId, trigger, status,
            stepResultsJson, lastEventSequence)
         VALUES ('run', 'workflow', 'owner', 'app', 'manual', 'running', ?, 1)`,
        [JSON.stringify(results)],
      );
      await legacy.query(
        `INSERT INTO automation_run_events
           (id, runId, ownerUserId, sequence, type, message)
         VALUES ('started', 'run', 'owner', 1, 'run.started', 'Started')`,
      );
    } finally {
      await legacy.destroy();
    }

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(
      createFastifyAdapter(),
    );
    await configureFastifyPlatform(app);
    await app.init();

    const runs = app.get(AutomationRunsRepository);
    const events = app.get(AutomationRunEventsRepository);
    const recovered = await runs.findByOwnerAndId('owner', 'run');
    expect(recovered).toMatchObject({ status: 'failed', lastEventSequence: 2 });
    expect(JSON.parse(recovered?.stepResultsJson ?? 'null')).toEqual(results);
    await expect(events.listForRun('owner', 'run')).resolves.toMatchObject([
      { sequence: 1, type: 'run.started' },
      { sequence: 2, type: 'run.failed' },
    ]);
  });

  it('boots with Fastify and initializes the SQLite schema', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      createFastifyAdapter(),
    );
    await configureFastifyPlatform(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/settings',
      headers: {
        'x-orchestrator-secret': 'test-secret',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');

    const headers = { 'x-orchestrator-secret': 'test-secret' };
    const aiCatalog = await app.inject({
      method: 'GET',
      url: '/api/v1/settings/ai-model-catalog',
      headers,
    });
    expect(aiCatalog.statusCode).toBe(409);
    expect(aiCatalog.json()).toMatchObject({
      code: 'feature_disabled',
      feature: 'feature.ai',
    });

    const update = await app.inject({
      method: 'PATCH',
      url: '/api/v1/features',
      headers,
      payload: {
        revision: 0,
        changes: [
          { key: 'feature.ai', enabled: true },
          { key: 'feature.workflows', enabled: false },
        ],
      },
    });
    expect(update.statusCode).toBe(200);
    const [enabledAi, disabledWorkflows] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/api/v1/settings/ai-model-catalog',
        headers,
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/automations?ownerUserId=owner-1',
        headers,
      }),
    ]);
    expect(enabledAi.statusCode).toBe(200);
    expect(disabledWorkflows.statusCode).toBe(409);
    expect(disabledWorkflows.json()).toMatchObject({
      code: 'feature_disabled',
      feature: 'feature.workflows',
    });

    const dataSource = app.get(DataSource);
    const schemaQueryRunner = dataSource.createQueryRunner();
    try {
      for (const entity of dataSource.entityMetadatas) {
        const table = await schemaQueryRunner.getTable(entity.tableName);
        expect(table?.columns.map((column) => column.name)).toEqual(
          expect.arrayContaining(
            entity.columns
              .filter((column) => !column.isVirtualProperty)
              .map((column) => column.databaseName),
          ),
        );
      }
    } finally {
      await schemaQueryRunner.release();
    }
    const journalMode = (await dataSource.query(
      'PRAGMA journal_mode',
    )) as Array<{
      journal_mode: string;
    }>;
    const busyTimeout = (await dataSource.query(
      'PRAGMA busy_timeout',
    )) as Array<{
      timeout: number;
    }>;
    expect(journalMode[0]?.journal_mode.toLowerCase()).toBe('wal');
    expect(busyTimeout[0]?.timeout).toBe(5000);

    const indexes = (await dataSource.query(
      `SELECT name, sql FROM sqlite_master WHERE type = 'index'`,
    )) as Array<{ name: string; sql: string | null }>;
    expect(indexes.map((index) => index.name)).toEqual(
      expect.arrayContaining([
        'android_applications_owner_created_idx',
        'automation_runs_active_target_unique',
        'automation_run_events_run_sequence_unique',
      ]),
    );
    expect(
      indexes.find(
        (index) => index.name === 'automation_runs_active_target_unique',
      )?.sql,
    ).toContain("status IN ('queued', 'running')");

    const queryPlan = (await dataSource.query(
      `EXPLAIN QUERY PLAN
       SELECT * FROM automation_runs
       WHERE ownerUserId = ? AND automationId = ?
       ORDER BY createdAt DESC LIMIT 50`,
      ['owner-1', 'automation-1'],
    )) as Array<{ detail: string }>;
    expect(
      queryPlan.some((row) =>
        row.detail.includes('automation_runs_owner_automation_created_idx'),
      ),
    ).toBe(true);

    const reservedTargetId = randomUUID();
    const reservations = await Promise.allSettled(
      [randomUUID(), randomUUID()].map((id) =>
        dataSource.query(
          `INSERT INTO automation_runs
           (id, automationId, ownerUserId, targetApplicationId, trigger, status)
           VALUES (?, ?, ?, ?, 'manual', 'queued')`,
          [id, randomUUID(), 'owner-1', reservedTargetId],
        ),
      ),
    );
    expect(
      reservations.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      reservations.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);

    const lifecycleReservations = await Promise.allSettled(
      [randomUUID(), randomUUID()].map((id) =>
        dataSource.query(
          `INSERT INTO android_app_lifecycle_jobs
           (id, applicationId, kind, status)
           VALUES (?, ?, 'start', 'pending')`,
          [id, 'app-with-reserved-lifecycle'],
        ),
      ),
    );
    expect(
      lifecycleReservations.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      lifecycleReservations.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);

    const runId = randomUUID();
    await dataSource.query(
      `INSERT INTO automation_runs
       (id, automationId, ownerUserId, targetApplicationId, trigger, status)
       VALUES (?, ?, ?, ?, 'manual', 'running')`,
      [runId, randomUUID(), 'owner-1', randomUUID()],
    );
    const events = app.get(AutomationRunEventsRepository);
    const appended = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        events.append({
          runId,
          ownerUserId: 'owner-1',
          type: 'step.progress',
          message: `event-${index}`,
        }),
      ),
    );
    expect(
      appended.map((event) => event.sequence).sort((a, b) => a - b),
    ).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    await expect(events.listForRun('owner-1', runId, 10)).resolves.toHaveLength(
      10,
    );
    await events.deleteForRuns('owner-1', []);
    await events.deleteForRuns('owner-1', [runId]);
    await expect(events.listForRun('owner-1', runId)).resolves.toEqual([]);
  });
});
