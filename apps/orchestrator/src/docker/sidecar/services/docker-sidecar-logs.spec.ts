import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  configureFastifyPlatform,
  createFastifyAdapter,
} from '../../../platform/http-platform';
import { SharedSecretGuard } from '../../../security/shared-secret.guard';
import { DockerSidecarController } from '../controllers/docker-sidecar.controller';
import { Readable } from 'node:stream';
import { DockerSidecarService } from './docker-sidecar.service';
import { DockerContainerLifecycleService } from '../../containers/services/docker-container-lifecycle.service';
import type { DockerEngineService } from '../../docker-engine.service';
import type { DockerSidecarAdbService } from './docker-sidecar-adb.service';
import type { DockerSidecarApiService } from './docker-sidecar-api.service';
import type { DockerSidecarImageService } from './docker-sidecar-image.service';
import type { DockerSidecarNetworkService } from './docker-sidecar-network.service';

const setup = () => {
  const id = 'display-sidecar-id';
  const config = new ConfigService({
    app: {
      displaySidecar: {
        containerName: 'rebroid-display-sidecar',
        image: 'rebroid/display-sidecar:latest',
        buildContext: '../display-sidecar',
        autoStart: true,
        port: 8000,
        publishedHostPort: 0,
        webrtcUdpPort: 40000,
        webrtcIceHost: '',
      },
    },
  });
  const container = {
    id,
    inspect: () =>
      Promise.resolve({
        Id: id,
        State: {
          Running: true,
          Status: 'running',
          ExitCode: 0,
          OOMKilled: false,
        },
        RestartCount: 1,
      }),
  };
  const engine = {
    docker: { getContainer: () => container },
    read: <T>(operation: () => Promise<T>) => operation(),
  } as unknown as DockerEngineService;
  const getBoundedContainerLogs = jest.fn<
    Promise<string>,
    [string, number, number]
  >();
  getBoundedContainerLogs.mockImplementation(async (_id, tail) =>
    Array.from({ length: tail }, (_, index) => `line ${index + 1}\n`).join(''),
  );
  const lifecycle = {
    findContainerByName: async () => ({ Id: id }),
    inspectContainer: container.inspect,
    getBoundedContainerLogs,
  } as unknown as DockerContainerLifecycleService;
  const api = {
    probeHealth: async () => 'Connection was refused.',
  } as unknown as DockerSidecarApiService;
  const service = new DockerSidecarService(
    config,
    engine,
    lifecycle,
    {} as DockerSidecarAdbService,
    api,
    {} as DockerSidecarNetworkService,
    {} as DockerSidecarImageService,
  );
  return { getBoundedContainerLogs, service, id };
};

describe('display sidecar log boundaries', () => {
  it('validates the display-sidecar logs query before reading logs', async () => {
    const config = new ConfigService({ app: { sharedSecret: 'test-secret' } });
    const moduleRef = await Test.createTestingModule({
      controllers: [DockerSidecarController],
      providers: [
        { provide: ConfigService, useValue: config },
        {
          provide: DockerSidecarService,
          useValue: { getLogs: (expanded: boolean) => ({ expanded }) },
        },
      ],
    }).compile();
    const app = moduleRef.createNestApplication<NestFastifyApplication>(
      createFastifyAdapter(),
    );
    app.useGlobalGuards(new SharedSecretGuard(config));
    try {
      await configureFastifyPlatform(app);
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      const url = '/api/v1/platform/display-sidecar/logs';
      const headers = { 'x-orchestrator-secret': 'test-secret' };
      expect((await app.inject({ url })).statusCode).toBe(401);
      expect(
        (await app.inject({ url: `${url}?expanded=invalid`, headers }))
          .statusCode,
      ).toBe(400);
      expect(
        (
          await app.inject({
            url: `${url}?expanded=true&expanded=false`,
            headers,
          })
        ).statusCode,
      ).toBe(400);
      expect((await app.inject({ url, headers })).json()).toEqual({
        expanded: false,
      });
      expect(
        (await app.inject({ url: `${url}?expanded=true`, headers })).json(),
      ).toEqual({ expanded: true });
    } finally {
      await app.close();
    }
  });

  it('closes the Docker log stream once the byte budget is exceeded', async () => {
    const stream = Readable.from([
      Buffer.alloc(16),
      Buffer.alloc(16),
      Buffer.alloc(16),
    ]);
    const engine = {
      docker: {
        modem: {
          dial: (
            _options: unknown,
            callback: (error: null, body: Readable) => void,
          ) => callback(null, stream),
        },
      },
      read: <T>(operation: () => Promise<T>) => operation(),
    } as unknown as DockerEngineService;
    const lifecycle = new DockerContainerLifecycleService(engine);

    await expect(
      lifecycle.getBoundedContainerLogs('sidecar', 20, 20),
    ).rejects.toMatchObject({ status: 413 });
    expect(stream.destroyed).toBe(true);
  });

  it('returns container state without reading logs during a failed health check', async () => {
    const { service, getBoundedContainerLogs } = setup();
    const health = await service.health();
    expect(health).toMatchObject({
      status: 'unhealthy',
      details: {
        containerStatus: 'running',
        exitCode: 0,
        oomKilled: false,
        restartCount: 1,
      },
    });
    expect(health.details).not.toHaveProperty('recentLogs');
    expect(getBoundedContainerLogs).not.toHaveBeenCalled();
  });

  it.each([
    [false, 20, 256 * 1024],
    [true, 200, 2 * 1024 * 1024],
  ])(
    'bounds Docker and the response for expanded=%s',
    async (expanded, lineLimit, readLimit) => {
      const { service, getBoundedContainerLogs, id } = setup();
      const logs = await service.getLogs(expanded);
      expect(getBoundedContainerLogs).toHaveBeenCalledWith(
        id,
        lineLimit + 1,
        readLimit,
      );
      expect(logs).toMatchObject({ lineLimit, truncated: true });
      expect(logs.output.split('\n')).toHaveLength(lineLimit);
      expect(logs.output).toMatch(/^line 2\n/);
    },
  );
});
