import { setImmediate } from 'node:timers/promises';
import { maximumProviderJsonBytes } from '../common/ai-provider-http';
import { providerStreamLimits } from '../common/ai-provider-stream';
import { AiProviderHealthService } from './ai-provider-health.service';
import { AiProviderModelDownloadService } from './ai-provider-model-download.service';
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

    writer.enqueue(encoder.encode('{"status":"success"}'));
    writer.close();
    await setImmediate();

    expect(service.get('local', job.id)).toMatchObject({
      status: 'completed',
      percent: 100,
    });
    expect(store.updateSettings).toHaveBeenCalledTimes(1);
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
});
