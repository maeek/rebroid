import { Controller, Get, Module, Post, Req } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyRequest } from 'fastify';
import { MetricsController } from '../metrics/metrics.controller';
import { MetricsService } from '../metrics/metrics.service';
import { SecurityModule } from '../security/security.module';
import {
  configureFastifyPlatform,
  createFastifyAdapter,
} from './http-platform';

@Controller()
class SmokeController {
  @Get('echo')
  echo() {
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
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
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
