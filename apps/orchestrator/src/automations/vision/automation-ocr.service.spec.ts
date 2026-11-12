import { AutomationOcrService } from './automation-ocr.service';

describe('AutomationOcrService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sends the lossless source screenshot to the configured OCR adapter', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(10_000);
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'available', detections: [] }), {
        status: 200,
      }),
    );
    global.fetch = fetchMock;
    const recordExchange = jest.fn();
    const service = new AutomationOcrService(
      {
        getStoredSettings: jest.fn().mockResolvedValue({
          services: {
            ocr: {
              endpoint: 'http://ocr.test',
              timeoutMs: 1_000,
              language: 'en',
              minConfidence: 0.4,
              maxImageDimension: 1600,
            },
          },
        }),
      } as never,
      {
        isEnabled: jest.fn().mockReturnValue(true),
      } as never,
    );

    await service.recognize(
      {
        dataUrl: 'data:image/png;base64,original-lossless-pixels',
        mimeType: 'image/png',
        capturedAt: '2026-07-10T00:00:00.000Z',
      },
      undefined,
      10_250,
      recordExchange,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://ocr.test/ocr/screenshot',
      expect.objectContaining({
        body: expect.stringContaining('original-lossless-pixels'),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      timeoutMs: 250,
    });
    expect(recordExchange).toHaveBeenCalledTimes(1);
    expect(recordExchange.mock.calls[0][0]).toMatchObject({
      request: {
        method: 'POST',
        path: '/ocr/screenshot',
        timeoutMs: 250,
        language: 'en',
        minConfidence: 0.4,
        maxImageDimension: 1600,
        image: { mimeType: 'image/png', dataUrlBytes: expect.any(Number) },
        bodyBytes: Buffer.byteLength(fetchMock.mock.calls[0][1].body as string),
      },
      response: {
        httpStatus: 200,
        status: 'available',
        detectionCount: 0,
        detections: [],
      },
    });
    expect(JSON.stringify(recordExchange.mock.calls[0][0])).not.toContain(
      'original-lossless-pixels',
    );
  });
  it.each([
    'invalid JSON',
    {},
    { status: 'available' },
    { status: 'failed', detections: [] },
    {
      status: 'available',
      detections: [{ bounds: { left: 0, top: 0, width: 1, height: 1 } }],
    },
    { status: 'available', detections: [], language: 'fr' },
    {
      status: 'available',
      detections: [
        { text: 'test', bounds: { left: 'bad', top: 0, width: 1, height: 1 } },
      ],
    },
  ])('fails malformed successful OCR response %j', async (payload) => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(
          typeof payload === 'string' ? payload : JSON.stringify(payload),
        ),
      );
    const service = new AutomationOcrService(
      {
        getStoredSettings: async () => ({
          services: {
            ocr: {
              endpoint: 'http://ocr.test',
              timeoutMs: 1_000,
              language: 'en',
            },
          },
        }),
      } as never,
      { isEnabled: () => true } as never,
    );
    await expect(
      service.recognize({
        dataUrl: 'image',
        mimeType: 'image/png',
        capturedAt: 'now',
      }),
    ).resolves.toMatchObject({
      status: 'failed',
      detections: [],
      error: 'OCR sidecar returned an invalid response.',
    });
  });

  it('preserves a valid empty OCR result', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'available',
          detections: [],
          language: 'en',
        }),
      ),
    );
    const service = new AutomationOcrService(
      {
        getStoredSettings: async () => ({
          services: {
            ocr: {
              endpoint: 'http://ocr.test',
              timeoutMs: 1_000,
              language: 'en',
            },
          },
        }),
      } as never,
      { isEnabled: () => true } as never,
    );
    await expect(
      service.recognize({
        dataUrl: 'image',
        mimeType: 'image/png',
        capturedAt: 'now',
      }),
    ).resolves.toMatchObject({
      status: 'available',
      detections: [],
      language: 'en',
    });
  });
  it('retains valid text detections and preprocessing diagnostics', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'available',
          language: 'en',
          engine: 'paddleocr',
          preprocessingAttempts: [
            { mode: 'raw', status: 'available', elapsedMs: 3 },
          ],
          detections: [
            {
              text: 'Settings',
              confidence: 0.99,
              bounds: { left: 0, top: 0, width: 0.8, height: 0.2 },
            },
          ],
        }),
      ),
    );
    const service = new AutomationOcrService(
      {
        getStoredSettings: async () => ({
          services: {
            ocr: {
              endpoint: 'http://ocr.test',
              timeoutMs: 1_000,
              language: 'en',
            },
          },
        }),
      } as never,
      { isEnabled: () => true } as never,
    );
    await expect(
      service.recognize({
        dataUrl: 'image',
        mimeType: 'image/png',
        capturedAt: 'now',
      }),
    ).resolves.toMatchObject({
      status: 'available',
      detections: [{ text: 'Settings', confidence: 0.99 }],
      preprocessingAttempts: [
        { mode: 'raw', status: 'available', elapsedMs: 3 },
      ],
    });
  });
});
