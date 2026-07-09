import { Test } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { AutomationRunEventsRepository } from './automations/persistence/automation-run-events.repository';
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

    const dataSource = app.get(DataSource);
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
