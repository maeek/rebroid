import { Test } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from './app.module';
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
  });
});
