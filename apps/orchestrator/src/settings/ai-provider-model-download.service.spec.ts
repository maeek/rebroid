import { setImmediate } from 'node:timers/promises';
import { ConfigService } from '@nestjs/config';
import { maximumProviderJsonBytes } from '../common/ai-provider-http';
import { providerStreamLimits } from '../common/ai-provider-stream';
import { AiProviderHealthService } from './ai-provider-health.service';
import { AiProviderModelDownloadService } from './ai-provider-model-download.service';
import { normalizeAiProvider } from './ai-provider-normalization';
import { OrchestratorSettingsStore } from './orchestrator-settings-store';

const setup = (response: Response) => {
  global.fetch = jest.fn().mockResolvedValue(response);
  const store = {
    getStoredSettings: jest.fn(async () => ({
      aiProviders: [
        { id: 'local', kind: 'ollama', baseUrl: 'http://ollama.test' },
      ],
    })),
    updateSettings: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AiProviderModelDownloadService(
    store as unknown as OrchestratorSettingsStore,
    new AiProviderHealthService(),
  );
  return { service, store };
};

describe('AiProviderModelDownloadService', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('preserves progress updates and consumes an unterminated final event', async () => {
    let writer!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        writer = controller;
      },
    });
    const { service, store } = setup(new Response(body));
    const job = await service.download('local', 'model:tag');
    const encoder = new TextEncoder();
    writer.enqueue(encoder.encode('{"status":"pulling",'));
    writer.enqueue(encoder.encode('"total":20,"completed":5}\r'));
    writer.enqueue(encoder.encode('\n'));
    await setImmediate();

    expect(service.get('local', job.id)).toMatchObject({
      status: 'running',
      message: 'pulling',
      percent: 25,
    });

    expect(service.listActive('local')).toEqual([
      expect.objectContaining({ id: job.id, percent: 25 }),
    ]);
    expect(service.listActive('other')).toEqual([]);
    writer.enqueue(encoder.encode('{"status":"success"}'));
    writer.close();
    await setImmediate();

    expect(service.get('local', job.id)).toMatchObject({
      status: 'completed',
      percent: 100,
    });
    expect(service.listActive('local')).toEqual([]);
    expect(store.updateSettings).toHaveBeenCalledTimes(1);
  });

  it('preserves the existing default model roles on a repeated download', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response('{"status":"success"}\n'));
    const store = new OrchestratorSettingsStore(
      new ConfigService({
        app: {
          container: { image: 'rebroid:test' },
          redroid: {
            defaultInactivityTimeoutSeconds: 900,
            maxApkUploadSizeMb: 64,
          },
        },
      }),
    );
    jest.spyOn(store, 'readStoredSettings').mockResolvedValue({
      aiProviders: [
        normalizeAiProvider({
          id: 'local',
          label: 'Local',
          kind: 'ollama',
          baseUrl: 'http://ollama.test',
          models: [
            {
              id: 'first',
              label: 'First',
              enabled: true,
              roles: ['controller', 'planner', 'vision'],
              defaultFor: [],
              settings: {},
            },
            {
              id: 'preferred',
              label: 'Preferred',
              enabled: true,
              roles: ['controller', 'planner', 'vision'],
              defaultFor: ['controller', 'planner', 'vision'],
              settings: {},
            },
          ],
        }),
      ],
    });
    let settings = await store.getStoredSettings();
    jest.spyOn(store, 'updateSettings').mockImplementation(async (update) => {
      settings = await update(settings);
      return settings;
    });
    const service = new AiProviderModelDownloadService(
      store,
      new AiProviderHealthService(),
    );

    const job = await service.download('local', 'preferred');
    await setImmediate();
    expect(service.get('local', job.id).status).toBe('completed');
    expect(
      settings.aiProviders[0].models.map(({ id, defaultFor }) => [
        id,
        defaultFor,
      ]),
    ).toEqual([
      ['first', []],
      ['preferred', ['controller', 'planner', 'vision']],
    ]);
  });

  it.each([
    {
      status: 200,
      size: providerStreamLimits.frameCharacters,
      message: 'stream frame size',
    },
    { status: 500, size: maximumProviderJsonBytes, message: 'JSON body size' },
  ])(
    'cancels an oversized HTTP $status body and leaves the model unregistered',
    async ({ status, size, message }) => {
      const cancel = jest.fn();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(size + 1).fill(120));
        },
        cancel,
      });
      const { service, store } = setup(new Response(body, { status }));
      const job = await service.download('local', 'model:tag');
      await setImmediate();

      expect(service.get('local', job.id)).toMatchObject({
        status: 'failed',
        message: expect.stringContaining(message),
      });
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(body.locked).toBe(false);
      expect(store.updateSettings).not.toHaveBeenCalled();
    },
  );

  it('preserves the provider error message for a valid HTTP error response', async () => {
    const { service } = setup(
      Response.json({ error: 'model unavailable' }, { status: 404 }),
    );
    const job = await service.download('local', 'model:tag');
    await setImmediate();

    expect(service.get('local', job.id)).toMatchObject({
      status: 'failed',
      message: 'Ollama model download failed: model unavailable',
    });
  });

  it.each([
    ['{"status":"pulling"}\n', 'without confirming success'],
    [
      '{"status":"success"}\n{"status":"pulling"}\n',
      'without confirming success',
    ],
    ['{"status":"pulling"}\n{"error":"connection lost"}\n', 'connection lost'],
  ])(
    'leaves the catalog unchanged for an unsuccessful download',
    async (body, message) => {
      const { service, store } = setup(new Response(body));
      const job = await service.download('local', 'model:tag');
      await setImmediate();
      expect(service.get('local', job.id)).toMatchObject({
        status: 'failed',
        message: expect.stringContaining(message),
      });
      expect(store.updateSettings).not.toHaveBeenCalled();
    },
  );

  it('rejects publication when the provider endpoint changes after admission', async () => {
    let writer!: ReadableStreamDefaultController<Uint8Array>;
    const { service, store } = setup(
      new Response(
        new ReadableStream({
          start(controller) {
            writer = controller;
          },
        }),
      ),
    );
    const changed = {
      aiProviders: [
        normalizeAiProvider({
          id: 'local',
          label: 'Local',
          kind: 'ollama',
          baseUrl: 'http://another.test',
          models: [],
        }),
      ],
    };
    store.updateSettings.mockImplementation(async (update) => update(changed));

    const job = await service.download('local', 'model:tag');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://ollama.test/api/pull',
      expect.anything(),
    );
    writer.enqueue(new TextEncoder().encode('{"status":"success"}\n'));
    writer.close();
    await setImmediate();

    expect(service.get('local', job.id)).toMatchObject({
      status: 'failed',
      message: expect.stringContaining('provider connection changed'),
    });
    expect(changed.aiProviders[0].models).toEqual([]);
  });

  it('evicts the oldest completed downloads from polling history', async () => {
    const { service } = setup(new Response());
    jest
      .mocked(global.fetch)
      .mockImplementation(async () => new Response('{"status":"success"}\n'));
    const ids: string[] = [];
    for (let index = 0; index < 129; index++) {
      ids.push((await service.download('local', `model:${index}`)).id);
      await setImmediate();
    }
    expect(() => service.get('local', ids[0])).toThrow('was not found');
    expect(service.get('local', ids[1]).status).toBe('completed');
    expect(service.listActive('local')).toEqual([]);
  });
});
