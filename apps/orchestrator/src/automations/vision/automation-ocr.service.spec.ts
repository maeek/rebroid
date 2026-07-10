import { AutomationOcrService } from './automation-ocr.service';

describe('AutomationOcrService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sends the lossless source screenshot to the configured OCR adapter', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'available', detections: [] }), {
        status: 200,
      }),
    );
    global.fetch = fetchMock;
    const service = new AutomationOcrService({
      getStoredSettings: jest.fn().mockResolvedValue({
        services: {
          ocr: {
            enabled: true,
            endpoint: 'http://ocr.test',
            timeoutMs: 1_000,
            languages: ['en'],
            minConfidence: 0.4,
            maxImageDimension: 1600,
            preprocessingModes: ['raw'],
          },
        },
      }),
    } as never);

    await service.recognize({
      dataUrl: 'data:image/png;base64,original-lossless-pixels',
      mimeType: 'image/png',
      capturedAt: '2026-07-10T00:00:00.000Z',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://ocr.test/ocr/screenshot',
      expect.objectContaining({
        body: expect.stringContaining('original-lossless-pixels'),
      }),
    );
  });
});
