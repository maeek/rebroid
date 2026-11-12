import { OcrSidecarService } from '../ocr-sidecar/ocr-sidecar.service';
import { OcrSidecarHealthService } from './ocr-sidecar-health.service';

const settings = {
  services: {
    ocr: {
      language: 'en',
      endpoint: 'http://ocr.test',
      timeoutMs: 1000,
    },
  },
};
const createSidecar = (
  getStoredSettings: () => Promise<unknown>,
  enabled = true,
) =>
  new OcrSidecarService(
    { getStoredSettings } as never,
    { isEnabled: () => enabled } as never,
  );

afterEach(() => jest.restoreAllMocks());

it.each([
  [{ ready: true, language: 'en' }, 200, 'healthy'],
  [{ ready: true, language: 'fr' }, 200, 'unhealthy'],
  [{ ready: true }, 200, 'unhealthy'],
  [{ ready: 'true', language: 'en' }, 200, 'unhealthy'],
  [{ ready: false, language: 'en' }, 503, 'unhealthy'],
])('reports sidecar readiness for %j', async (body, httpStatus, status) => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(Response.json(body, { status: httpStatus }));
  const service = new OcrSidecarHealthService(
    createSidecar(async () => settings),
  );
  await expect(service.health()).resolves.toMatchObject({
    status,
    ok: status === 'healthy',
  });
});

it('skips settings and transport when the feature is disabled', async () => {
  const getStoredSettings = jest
    .fn()
    .mockRejectedValue(new Error('Disk read failed'));
  const fetch = jest.spyOn(globalThis, 'fetch');
  const sidecar = createSidecar(getStoredSettings, false);
  await expect(sidecar.recognize('image')).resolves.toEqual({
    status: 'disabled',
  });
  await expect(
    new OcrSidecarHealthService(sidecar).health(),
  ).resolves.toMatchObject({ status: 'disabled' });
  expect(getStoredSettings).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

it('reports a settings read failure without failing perception or the health aggregate', async () => {
  const sidecar = createSidecar(
    jest.fn().mockRejectedValue(new Error('Disk read failed')),
  );
  await expect(sidecar.recognize('image')).resolves.toMatchObject({
    status: 'failed',
    error: 'OCR settings could not be loaded.',
  });
  await expect(
    new OcrSidecarHealthService(sidecar).health(),
  ).resolves.toMatchObject({
    status: 'unhealthy',
    message: 'OCR settings could not be loaded.',
  });
});

it('preserves the safe warmup failure classification for operators', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json(
      {
        ready: false,
        language: 'en',
        warmupState: 'retrying',
        failureCode: 'ocr_model_download_unavailable',
        message: 'OCR model download is temporarily unavailable.',
      },
      { status: 503 },
    ),
  );
  const health = new OcrSidecarHealthService(
    createSidecar(async () => settings),
  );
  await expect(health.health()).resolves.toMatchObject({
    status: 'unhealthy',
    message: 'OCR model download is temporarily unavailable.',
    details: {
      response: {
        warmupState: 'retrying',
        failureCode: 'ocr_model_download_unavailable',
      },
    },
  });
});

it('rejects an oversized readiness response', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response('x'.repeat(16 * 1024 + 1)));
  const health = new OcrSidecarHealthService(
    createSidecar(async () => settings),
  );
  await expect(health.health()).resolves.toMatchObject({
    status: 'unhealthy',
    message: 'OCR sidecar response exceeded the size limit.',
  });
});
