import {
  Body,
  Controller,
  Get,
  Logger,
  Module,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyRequest } from 'fastify';
import { CreateAndroidApplicationDto } from '../android-apps/common/dto/create-android-application.dto';
import { MetricsController } from '../metrics/metrics.controller';
import { MetricsService } from '../metrics/metrics.service';
import { SecurityModule } from '../security/security.module';
import {
  configureFastifyPlatform,
  createFastifyAdapter,
  createOrchestratorApplication,
} from './http-platform';

@Controller()
class SmokeController {
  private readonly logger = new Logger(SmokeController.name);

  @Get('echo')
  echo() {
    return { ok: true };
  }

  @Get('log')
  log() {
    this.logger.log({ event: 'smoke', details: { ready: true } });
    this.logger.debug('debug details');
    this.logger.error(
      'operation failed',
      'Error: operation failed\n    at test.ts:1:1',
    );
    return { ok: true };
  }

  @Get('health/live')
  live() {
    return { ok: true };
  }

  @Post('upload')
  upload(@Req() request: FastifyRequest) {
    return {
      contentType: request.headers['content-type'],
      bodyIsStream:
        typeof (request.body as { pipe?: unknown } | undefined)?.pipe ===
        'function',
    };
  }

  @Post('validate-app')
  validateApp(@Body() dto: CreateAndroidApplicationDto) {
    return dto;
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => ({
          app: {
            corsOrigins: [],
            sharedSecret: 'test-secret',
          },
        }),
      ],
    }),
    SecurityModule,
  ],
  controllers: [SmokeController, MetricsController],
  providers: [
    {
      provide: MetricsService,
      useValue: {
        registry: {
          contentType: 'text/plain; version=0.0.4',
          metrics: async () => 'rebroid_metric 1\n',
        },
        dockerSnapshot: () => ({
          collectedAt: new Date().toISOString(),
          containers: [],
        }),
      },
    },
  ],
})
class SmokeModule {}

it('writes Nest startup, service and HTTP logs as single-line Pino records', async () => {
  const output: string[] = [];
  const app = await createOrchestratorApplication(SmokeModule, {
    write: (chunk) => {
      output.push(chunk);
    },
  });
  try {
    await configureFastifyPlatform(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    await app.inject({
      method: 'GET',
      url: '/api/v1/log?secret=hidden',
      headers: {
        'x-orchestrator-secret': 'test-secret',
        'x-request-id': 'request-1',
      },
    });
    const records = output
      .join('')
      .trimEnd()
      .split('\n')
      .map((line) => JSON.parse(line) as unknown);
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ level: 30, context: 'NestFactory' }),
        expect.objectContaining({
          level: 30,
          context: 'SmokeController',
          event: 'smoke',
          details: { ready: true },
        }),
        expect.objectContaining({
          level: 20,
          context: 'SmokeController',
          msg: 'debug details',
        }),
        expect.objectContaining({
          level: 50,
          context: 'SmokeController',
          msg: 'operation failed',
          stack: 'Error: operation failed\n    at test.ts:1:1',
        }),
        expect.objectContaining({
          level: 30,
          reqId: 'request-1',
          req: { method: 'GET', url: '/api/v1/log' },
        }),
      ]),
    );
    expect(output.join('')).not.toMatch(/secret=hidden|test-secret/);
  } finally {
    await app.close();
    Logger.overrideLogger(new Logger());
  }
});

describe('Fastify HTTP platform', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SmokeModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      createFastifyAdapter(),
    );
    await configureFastifyPlatform(app);
    SwaggerModule.setup(
      'docs',
      app,
      SwaggerModule.createDocument(app, new DocumentBuilder().build()),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('serves development documentation and static assets without optional dependency failures', async () => {
    for (const url of ['/docs', '/docs/swagger-ui-bundle.js', '/docs-json']) {
      expect((await app.inject({ method: 'GET', url })).statusCode).toBe(200);
    }
  });

  it('uses the shared-secret guard globally and keeps liveness public', async () => {
    await app
      .inject({ method: 'GET', url: '/api/v1/echo' })
      .then((response) => {
        expect(response.statusCode).toBe(401);
      });

    await app
      .inject({ method: 'GET', url: '/health/live' })
      .then((response) => {
        expect(response.statusCode).toBe(200);
      });
  });

  it('sets request id and no-store headers on API responses', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/echo',
      headers: {
        'x-request-id': 'request-1',
        'x-orchestrator-secret': 'test-secret',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe('request-1');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('identifies invalid create-app fields while retaining the validation messages', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/validate-app',
      headers: { 'x-orchestrator-secret': 'test-secret' },
      payload: { name: 'A', memoryLimitMb: 32 },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      fields: ['name', 'memoryLimitMb'],
      message: expect.arrayContaining([
        expect.stringContaining('name'),
        expect.stringContaining('memoryLimitMb'),
      ]),
    });
  });

  it('returns Prometheus metrics with the registry content type', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/metrics',
      headers: {
        'x-orchestrator-secret': 'test-secret',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toBe('rebroid_metric 1\n');
  });

  it('accepts multipart streams without Express middleware', async () => {
    const boundary = 'rebroid-test-boundary';
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/upload',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'x-orchestrator-secret': 'test-secret',
      },
      payload: [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="test.txt"',
        'Content-Type: text/plain',
        '',
        'hello',
        `--${boundary}--`,
        '',
      ].join('\r\n'),
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      contentType: `multipart/form-data; boundary=${boundary}`,
      bodyIsStream: true,
    });
  });
});
