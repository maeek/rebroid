import { OcrSidecarService } from '../../ocr-sidecar/ocr-sidecar.service';
import { AutomationOcrService } from './automation-ocr.service';

const image = {
  dataUrl: 'data:image/png;base64,original-lossless-pixels',
  mimeType: 'image/png',
  capturedAt: '2026-07-10T00:00:00.000Z',
};
const settings = {
  services: {
    ocr: {
      endpoint: 'http://ocr.test',
      timeoutMs: 1000,
      language: 'en',
      minConfidence: 0.4,
      maxImageDimension: 1600,
    },
  },
};
const createService = () =>
  new AutomationOcrService(
    new OcrSidecarService(
      { getStoredSettings: async () => settings } as never,
      { isEnabled: () => true } as never,
    ),
  );

afterEach(() => jest.restoreAllMocks());

it('sends the original screenshot and remaining deadline to OCR and returns bounded trace metadata', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(10_000);
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      Response.json({ status: 'available', detections: [], language: 'en' }),
    );

  const reading = await createService().recognize(image, undefined, 10_250);
  expect(fetch).toHaveBeenCalledWith(
    'http://ocr.test/ocr/screenshot',
    expect.any(Object),
  );
  const body = fetch.mock.calls[0][1]?.body as string;
  expect(JSON.parse(body)).toEqual({
    dataUrl: image.dataUrl,
    timeoutMs: 250,
    language: 'en',
    minConfidence: 0.4,
    maxImageDimension: 1600,
  });
  expect(reading).toMatchObject({
    result: { status: 'available', detections: [], language: 'en' },
    trace: {
      parameters: { timeoutMs: 250, language: 'en' },
      requestBytes: Buffer.byteLength(body),
      httpStatus: 200,
    },
  });
  expect(JSON.stringify(reading)).not.toContain(image.dataUrl);
});

it.each([
  'invalid JSON',
  {},
  { status: 'available', language: 'en' },
  { status: 'failed', detections: [], language: 'en' },
  { status: 'available', detections: [] },
  { status: 'available', detections: [], language: 'fr' },
  { status: 'available', detections: [], language: 42 },
  {
    status: 'available',
    language: 'en',
    detections: [{ bounds: { left: 0, top: 0, width: 1, height: 1 } }],
  },
  {
    status: 'available',
    language: 'en',
    detections: [
      { text: 'test', bounds: { left: 'bad', top: 0, width: 1, height: 1 } },
    ],
  },
])('fails malformed successful OCR response %j', async (payload) => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(
        typeof payload === 'string' ? payload : JSON.stringify(payload),
      ),
    );
  await expect(createService().recognize(image)).resolves.toMatchObject({
    result: {
      status: 'failed',
      detections: [],
      error: 'OCR sidecar returned an invalid response.',
    },
    trace: { code: 'ocr_invalid_response' },
  });
});

it('retains valid text detections and preprocessing diagnostics', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({
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
  );
  await expect(createService().recognize(image)).resolves.toMatchObject({
    result: {
      status: 'available',
      detections: [{ text: 'Settings', confidence: 0.99 }],
      preprocessingAttempts: [
        { mode: 'raw', status: 'available', elapsedMs: 3 },
      ],
    },
  });
});

it('keeps the request cancellable after response headers have arrived', async () => {
  let bodyStarted!: () => void;
  const readingBody = new Promise<void>((resolve) => {
    bodyStarted = resolve;
  });
  const abort = new AbortController();
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (_url, request) => {
    const stream = new ReadableStream({
      start(controller) {
        request?.signal?.addEventListener('abort', () =>
          controller.error(request.signal?.reason),
        );
      },
      pull() {
        bodyStarted();
      },
    });
    return new Response(stream);
  });
  const pending = createService().recognize(image, abort.signal);
  await readingBody;
  abort.abort();
  await expect(pending).resolves.toMatchObject({
    result: { status: 'failed', detections: [] },
    trace: { httpStatus: 200, canceled: true },
  });
});

it('marks OCR results from older sidecars incomplete when a preprocessing pass failed', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({
      status: 'available',
      language: 'en',
      detections: [],
      preprocessingAttempts: [
        { mode: 'raw', status: 'available', textBoxCount: 0 },
        { mode: 'grayscale', status: 'failed' },
      ],
    }),
  );
  await expect(createService().recognize(image)).resolves.toMatchObject({
    result: { status: 'available', searchComplete: false },
  });
});

it('stops reading an oversized chunked OCR response before parsing it', async () => {
  const cancel = jest.fn();
  let pulls = 0;
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (pulls++ === 0) {
          controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1));
        } else {
          controller.close();
        }
      },
      cancel,
    },
    { highWaterMark: 0 },
  );
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body));
  await expect(createService().recognize(image)).resolves.toMatchObject({
    result: { status: 'failed', detections: [] },
    trace: { code: 'ocr_response_too_large' },
  });
  expect(pulls).toBe(1);
  expect(cancel).toHaveBeenCalledTimes(1);
});

it.each([
  { name: 'too many detections', labels: Array<string>(513).fill('Settings') },
  { name: 'a long label', labels: ['é'.repeat(1025)] },
])('rejects OCR responses with $name', async ({ labels }) => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({
      status: 'available',
      language: 'en',
      detections: labels.map((text) => ({
        text,
        bounds: { left: 0, top: 0, width: 1, height: 1 },
      })),
    }),
  );
  const reading = await createService().recognize(image);
  expect(reading.result.status).toBe('failed');
  expect(reading.result.detections).toHaveLength(0);
  expect(reading.trace?.code).toBe('ocr_invalid_response');
});
