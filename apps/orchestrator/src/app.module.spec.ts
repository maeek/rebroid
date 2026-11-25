import { Test } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { AndroidApplication } from './android-apps/android-application.entity';
import { AutomationRunEventsRepository } from './automations/persistence/automation-run-events.repository';
import { AutomationRunsRepository } from './automations/persistence/automation-runs.repository';
import { InitializeSqliteSchema1800000008000 } from './database/migrations/1800000008000-initialize-sqlite-schema';
import {
  configureFastifyPlatform,
  createFastifyAdapter,
} from './platform/http-platform';
import type { ScheduledTaskDto } from './scheduled-tasks/dto/scheduled-task.dto';

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

  it('preserves stored workflow results when recovering an interrupted run', async () => {
    const results = [{ stepId: 'first' }, { stepId: 'second' }];
    const database = await new DataSource({
      type: 'better-sqlite3',
      database: join(temporaryDirectory, 'orchestrator.sqlite'),
      migrations: [InitializeSqliteSchema1800000008000],
      migrationsRun: true,
    }).initialize();
    try {
      await database.query(
        `INSERT INTO automation_runs
           (id, automationId, ownerUserId, targetDeviceId, trigger, status,
            lastEventSequence)
         VALUES ('run', 'workflow', 'owner', 'app', 'manual', 'running', 1)`,
      );
      for (const [index, result] of results.entries()) {
        await database.query(
          `INSERT INTO automation_run_step_results (runId, sequence, resultJson)
           VALUES ('run', ?, ?)`,
          [index + 1, JSON.stringify(result)],
        );
      }
      await database.query(
        `INSERT INTO automation_run_events
           (id, runId, ownerUserId, sequence, type, message)
         VALUES ('started', 'run', 'owner', 1, 'run.started', 'Started')`,
      );
    } finally {
      await database.destroy();
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
    const recovered = await runs.findByOwnerAndId('owner', 'run');
    expect(recovered).toMatchObject({ status: 'failed', lastEventSequence: 2 });
    expect(JSON.parse(recovered?.stepResultsJson ?? 'null')).toEqual(results);
    const route = '/api/v1/automations/runs/run/events/conversation';
    const headers = { 'x-orchestrator-secret': 'test-secret' };
    const conversation = await app.inject({
      method: 'GET',
      url: `${route}?ownerUserId=owner`,
      headers,
    });
    expect(conversation.statusCode).toBe(200);
    expect(conversation.json()).toMatchObject([
      { sequence: 1, type: 'run.started' },
      { sequence: 2, type: 'run.failed' },
    ]);
    const foreign = await app.inject({
      method: 'GET',
      url: `${route}?ownerUserId=someone-else`,
      headers,
    });
    expect(foreign.statusCode).toBe(404);
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

    const scheduledTasks = await app.inject({
      method: 'GET',
      url: '/api/v1/scheduled-tasks',
      headers: { 'x-orchestrator-secret': 'test-secret' },
    });
    expect(scheduledTasks.statusCode).toBe(200);
    const historyTask = scheduledTasks
      .json<ScheduledTaskDto[]>()
      .find((task) => task.predefinedKey === 'clean-workflow-history');
    expect(historyTask).toMatchObject({
      enabled: true,
      payload: { retentionDays: 7 },
    });
    const retentionUpdate = await app.inject({
      method: 'PATCH',
      url: `/api/v1/scheduled-tasks/${historyTask?.id}`,
      headers: { 'x-orchestrator-secret': 'test-secret' },
      payload: { payload: { retentionDays: 14 } },
    });
    expect(retentionUpdate.statusCode).toBe(200);
    expect(retentionUpdate.json()).toMatchObject({
      enabled: true,
      cronExpression: historyTask?.cronExpression,
      nextRunAt: historyTask?.nextRunAt,
      payload: { retentionDays: 14 },
    });
    const database = app.get(DataSource);
    await database.query(
      `INSERT INTO automation_runs
         (id, automationId, ownerUserId, targetDeviceId, trigger, status, completedAt)
       VALUES
         ('expired', 'workflow', 'owner', 'app', 'manual', 'success', datetime('now', '-15 days')),
         ('retained', 'workflow', 'owner', 'app', 'manual', 'success', datetime('now', '-10 days'))`,
    );
    const retentionRun = await app.inject({
      method: 'POST',
      url: `/api/v1/scheduled-tasks/${historyTask?.id}/run`,
      headers: { 'x-orchestrator-secret': 'test-secret' },
    });
    expect(retentionRun.statusCode).toBe(201);
    expect(retentionRun.json()).toMatchObject({ lastStatus: 'success' });
    const runs = app.get(AutomationRunsRepository);
    await expect(runs.findByOwnerAndId('owner', 'expired')).resolves.toBeNull();
    await expect(
      runs.findByOwnerAndId('owner', 'retained'),
    ).resolves.toMatchObject({ id: 'retained' });

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
    const latestBuildUrl = '/api/v1/platform/container-images/builds/latest';
    const [latestBuild, invalidBuildKind] = await Promise.all([
      app.inject({
        method: 'GET',
        url: `${latestBuildUrl}?buildKind=dockerfile_overlay`,
        headers,
      }),
      app.inject({
        method: 'GET',
        url: `${latestBuildUrl}?buildKind=unknown`,
        headers,
      }),
    ]);
    expect(latestBuild.statusCode).toBe(200);
    expect(latestBuild.json()).toEqual({ job: null });
    expect(invalidBuildKind.statusCode).toBe(400);

    const renderingUrl = '/api/v1/settings/android-rendering';
    const rendering = await app.inject({
      method: 'GET',
      url: renderingUrl,
      headers,
    });
    expect(rendering.statusCode).toBe(200);
    expect(rendering.json()).toEqual({ mode: 'software', renderDevice: null });
    for (const renderDevice of [
      null,
      '/dev/dri/../sda',
      '/dev/dri/renderD128\n',
    ]) {
      const invalid = await app.inject({
        method: 'PUT',
        url: renderingUrl,
        headers,
        payload: { mode: 'host', renderDevice },
      });
      expect(invalid.statusCode).toBe(400);
    }
    const saved = await app.inject({
      method: 'PUT',
      url: renderingUrl,
      headers,
      payload: { mode: 'host', renderDevice: '/dev/dri/renderD128' },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toEqual({
      mode: 'host',
      renderDevice: '/dev/dri/renderD128',
    });

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

    await database.query(`
      INSERT INTO automations (id, ownerUserId, name, definitionJson)
      VALUES ('named', 'owner-1', 'Visible workflow', '{}'),
             ('foreign', 'owner-2', 'Private workflow', '{}')
    `);
    await database.query(`
      INSERT INTO automation_runs
        (id, automationId, ownerUserId, targetDeviceId, trigger, status, createdAt)
      VALUES ('queued', 'named', 'owner-1', 'app-1', 'manual', 'queued', '2026-01-04'),
             ('ad-hoc', 'ephemeral-ai-1', 'owner-1', 'app-2', 'manual', 'running', '2026-01-03'),
             ('unknown', 'foreign', 'owner-1', 'app-3', 'manual', 'running', '2026-01-02'),
             ('other-owner', 'foreign', 'owner-2', 'app-4', 'manual', 'running', '2026-01-01'),
             ('completed', 'named', 'owner-1', 'app-1', 'manual', 'success', '2026-01-01')
    `);
    const activeRunsUrl = '/api/v1/automations/runs/active?ownerUserId=owner-1';
    const activeRuns = await app.inject({
      method: 'GET',
      url: activeRunsUrl,
      headers,
    });
    expect(activeRuns.statusCode).toBe(200);
    const activeRun = {
      id: 'queued',
      automationId: 'named',
      targetDeviceId: 'app-1',
      status: 'queued',
      createdAt: '2026-01-04T00:00:00.000Z',
      workflowName: 'Visible workflow',
    };
    expect(activeRuns.json()).toEqual([
      activeRun,
      {
        ...activeRun,
        id: 'ad-hoc',
        automationId: 'ephemeral-ai-1',
        targetDeviceId: 'app-2',
        status: 'running',
        createdAt: '2026-01-03T00:00:00.000Z',
        workflowName: null,
      },
      {
        ...activeRun,
        id: 'unknown',
        automationId: 'foreign',
        targetDeviceId: 'app-3',
        status: 'running',
        createdAt: '2026-01-02T00:00:00.000Z',
        workflowName: null,
      },
    ]);

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

    const runsWithWorkflowsDisabled = await app.inject({
      method: 'GET',
      url: activeRunsUrl,
      headers,
    });
    expect(runsWithWorkflowsDisabled.statusCode).toBe(200);
    expect(runsWithWorkflowsDisabled.json()).toMatchObject([
      { ...activeRun, workflowName: null },
      { id: 'ad-hoc', workflowName: null },
      { id: 'unknown', workflowName: null },
    ]);

    const dataSource = app.get(DataSource);
    const deviceId = randomUUID();
    await dataSource.getRepository(AndroidApplication).insert({
      id: deviceId,
      name: 'Managed utility runtime',
      ownerUserId: 'owner-1',
      containerImage: 'utility:local',
      containerName: 'test-runtime',
      networkName: 'test-network',
      volumeName: 'test-volume',
    });
    for (const path of ['/devices', '/devices/gallery']) {
      const response = await app.inject({
        url: `/api/v1${path}?ownerUserId=owner-1`,
        headers,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([
        expect.objectContaining({ id: deviceId, kind: 'managed' }),
      ]);
    }
    const device = await app.inject({
      url: `/api/v1/devices/${deviceId}`,
      headers,
    });
    expect(device.json()).toMatchObject({
      id: deviceId,
      kind: 'managed',
      runtime: { kind: 'generic', containerId: null },
    });
    await expect(
      dataSource.query('UPDATE android_devices SET kind = ? WHERE id = ?', [
        'external',
        deviceId,
      ]),
    ).rejects.toThrow('CHECK constraint failed');

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
        'android_devices_owner_created_idx',
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
           (id, automationId, ownerUserId, targetDeviceId, trigger, status)
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
          `INSERT INTO android_device_lifecycle_jobs
           (id, deviceId, kind, status)
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
       (id, automationId, ownerUserId, targetDeviceId, trigger, status)
       VALUES (?, ?, ?, ?, 'manual', 'running')`,
      [runId, randomUUID(), 'owner-1', randomUUID()],
    );
    const events = app.get(AutomationRunEventsRepository);
    const appended = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        events.appendWhileRunning({
          runId,
          ownerUserId: 'owner-1',
          type: 'step.progress',
          message: `event-${index}`,
        }),
      ),
    );
    expect(
      appended.map((event) => event?.sequence ?? 0).sort((a, b) => a - b),
    ).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    await expect(
      events.listReplayPage('owner-1', runId, 10, Number.MAX_SAFE_INTEGER),
    ).resolves.toHaveLength(10);
    await events.deleteForRuns('owner-1', []);
    await events.deleteForRuns('owner-1', [runId]);
    await expect(
      events.listReplayPage('owner-1', runId, 0, Number.MAX_SAFE_INTEGER),
    ).resolves.toEqual([]);
  });
});
