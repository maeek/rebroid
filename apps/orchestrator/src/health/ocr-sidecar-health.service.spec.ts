import { OcrSidecarHealthService } from './ocr-sidecar-health.service';

it.each([
  ['en', 'healthy'],
  ['fr', 'unhealthy'],
  [undefined, 'unhealthy'],
])(
  'reports configured readiness for deployed language %s',
  async (language, status) => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ ready: true, language }));
    const service = new OcrSidecarHealthService(
      {
        getStoredSettings: async () => ({
          services: {
            ocr: {
              language: 'en',
              endpoint: 'http://ocr.test',
              timeoutMs: 1000,
            },
          },
        }),
      } as never,
      { isEnabled: () => true } as never,
    );
    try {
      await expect(service.health()).resolves.toMatchObject({
        status,
        ok: status === 'healthy',
      });
    } finally {
      fetch.mockRestore();
    }
  },
);
