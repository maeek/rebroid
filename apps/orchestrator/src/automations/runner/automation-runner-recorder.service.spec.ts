import { AutomationRunnerRecorderService } from './automation-runner-recorder.service';

const run = { id: 'run', ownerUserId: 'owner' } as never;
const step = { stepId: 'observe', path: 'steps[0]' } as never;
const image = { dataUrl: '', mimeType: 'image/png', capturedAt: 'now' };
const result = { status: 'available', detections: [] } as const;
const trace = {
  parameters: {
    language: 'en',
    timeoutMs: 1000,
    minConfidence: 0.4,
    maxImageDimension: 1600,
  },
  requestBytes: 123,
  httpStatus: 200,
  responseBytes: 20,
  durationMs: 100,
  code: null,
  canceled: false,
  image: null,
};

it('publishes OCR exchanges in order at step completion through the running-only writer', async () => {
  const emitWhileRunning = jest.fn().mockResolvedValue(true);
  const recorder = new AutomationRunnerRecorderService({
    emitWhileRunning,
  } as never);
  const exchanges = recorder.ocrExchangeRecorder(run, step);

  exchanges.record({ ...result, detections: [] }, trace, image);
  exchanges.record(
    { ...result, detections: [] },
    { ...trace, httpStatus: 503 },
    image,
  );
  await Promise.resolve();
  expect(emitWhileRunning).not.toHaveBeenCalled();

  await exchanges.flush();
  expect(
    emitWhileRunning.mock.calls.map(
      ([event]) => event.data.response.httpStatus,
    ),
  ).toEqual([200, 503]);
  expect(emitWhileRunning).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'vision.ocr.exchange',
      stepId: 'observe',
      data: expect.objectContaining({ path: 'steps[0]', preview: null }),
    }),
  );
});

it('cancellation stops waiting for a blocked write and discards unpublished exchanges', async () => {
  let resume!: () => void;
  let writing!: () => void;
  const blocked = new Promise<boolean>((resolve) => {
    resume = () => resolve(true);
  });
  const started = new Promise<void>((resolve) => {
    writing = resolve;
  });
  const emitWhileRunning = jest.fn(() => {
    writing();
    return blocked;
  });
  const controller = new AbortController();
  const recorder = new AutomationRunnerRecorderService({
    emitWhileRunning,
  } as never);
  const exchanges = recorder.ocrExchangeRecorder(run, step, controller.signal);

  exchanges.record({ ...result, detections: [] }, trace, image);
  exchanges.record({ ...result, detections: [] }, trace, image);
  const flush = exchanges.flush();
  await started;
  try {
    controller.abort();
    await flush;
  } finally {
    resume();
  }
  await blocked;
  expect(emitWhileRunning).toHaveBeenCalledTimes(1);
});
