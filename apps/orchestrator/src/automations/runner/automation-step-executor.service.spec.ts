import type { AutomationCommandContext } from '../commands/automation-command.types';
import { AutomationConditionService } from '../condition/automation-condition.service';
import { AutomationRunTrigger } from '../entities/automation-run.entity';
import type { AutomationScreenObservation } from '../vision/automation-vision.types';
import { AutomationStepExecutorService } from './automation-step-executor.service';
import type { AndroidAppsAutomationPort } from '../../android-apps/contracts/android-apps-automation.port';
import type { AutomationExecutionState } from './automation-runner-execution.types';
import { AutomationVisionCaptureService } from '../vision/automation-vision-capture.service';
import { AutomationVisionFusionService } from '../vision/automation-vision-fusion.service';
import { AutomationVisionService } from '../vision/automation-vision.service';
import { VisionAutomationCommandsService } from '../commands/vision-automation-commands.service';

const withAutomationTarget: AndroidAppsAutomationPort['withAutomationTarget'] =
  (app, _signal, operation) => operation(app);
const stepOptions = {
  path: 'steps',
  admitTargetWork: <T>(operation: () => Promise<T>) => operation(),
};

const createService = ({
  registryExecute = jest.fn(),
  recordActionStarted = jest.fn(),
  recordActionCompleted = jest.fn().mockResolvedValue(true),
  recordStepFailed = jest.fn().mockResolvedValue(true),
  recordControlCompleted = jest.fn().mockResolvedValue(true),
  recordRepeatStarted = jest.fn().mockResolvedValue(true),
  ocrExchangeRecorder = jest.fn(),
  evaluate = jest.fn(),
  resolveValueRef = jest.fn(),
  withAutomationTarget: withTarget = withAutomationTarget,
  adb = {},
} = {}) => {
  const service = new AutomationStepExecutorService(
    { execute: registryExecute } as never,
    {} as never,
    {
      recordActionStarted,
      recordActionCompleted,
      recordStepFailed,
      recordControlCompleted,
      recordRepeatStarted,
      ocrExchangeRecorder,
    } as never,
    { evaluate, resolveValueRef } as never,
    {
      withAutomationTarget: withTarget,
      automationAdapters: () => ({ adb, display: {}, networkPolicy: {} }),
    } as never,
  );

  return {
    service,
    registryExecute,
    recordActionStarted,
    recordActionCompleted,
    recordStepFailed,
    recordControlCompleted,
  };
};

const createState = (): AutomationExecutionState => ({
  app: { id: 'app-1', name: 'Demo' } as never,
  target: {
    id: 'app-1',
    name: 'Demo',
    containerStartedAt: '2026-11-12T10:00:00Z',
  } as never,
  canUseInternet: false,
  runId: 'run-1',
  trigger: AutomationRunTrigger.Manual,
  targetProfileMode: null,
  targetProfileName: null,
  outputsByStepId: new Map(),
});

const createRun = (automationId?: string) =>
  ({
    id: 'run-1',
    ownerUserId: 'user-1',
    automationId,
  }) as never;

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('AutomationStepExecutorService', () => {
  it.each([0, undefined])(
    'uses a resolved coordinate of %s or fails before dispatch when missing',
    async (x) => {
      const conditions = new AutomationConditionService();
      const { service, registryExecute, recordStepFailed } = createService({
        registryExecute: jest.fn().mockResolvedValue({ summary: 'Tapped.' }),
        resolveValueRef: jest.fn(conditions.resolveValueRef.bind(conditions)),
      });
      const state = createState();
      state.outputsByStepId.set('locate', { centerX: x });
      const result = await service.executeSteps(
        [
          {
            id: 'tap',
            uses: 'android.tapNormalized',
            with: {
              x: {
                $ref: {
                  source: 'stepOutput',
                  stepId: 'locate',
                  outputKey: 'centerX',
                },
              },
              y: 0.5,
            },
          },
        ],
        state,
        createRun(),
        { ...stepOptions, isRunCanceled: () => false },
      );
      expect(result.failed).toBe(x === undefined);
      if (x === undefined) {
        expect(registryExecute).not.toHaveBeenCalled();
        expect(recordStepFailed.mock.calls[0]?.[3]).toContain(
          'the step returned no value',
        );
      } else {
        expect(registryExecute).toHaveBeenCalledWith(
          'android.tapNormalized',
          { x, y: 0.5 },
          expect.any(Object),
        );
      }
    },
  );

  it('lets an AI deadline finish the decision while keeping later steps behind the admitted command', async () => {
    const deadline = new AbortController();
    const dispatch = deferred();
    const release = deferred();
    const blocked = deferred();
    const registryExecute = jest
      .fn()
      .mockImplementationOnce(
        async (_uses, _input, context: AutomationCommandContext) => {
          await expect(
            context.executeCommand!({
              uses: 'android.tapNormalized',
              input: { x: 0.5, y: 0.5 },
              signal: deadline.signal,
            }),
          ).rejects.toMatchObject({ name: 'TimeoutError' });
          blocked.resolve();
          return { summary: 'Timed out.' };
        },
      )
      .mockImplementationOnce(async () => {
        dispatch.resolve();
        await release.promise;
        return { summary: 'Tap settled.' };
      })
      .mockResolvedValueOnce({ summary: 'Waited.' });
    const { service, recordActionCompleted } = createService({
      registryExecute,
    });
    const execution = service.executeSteps(
      [
        {
          id: 'agent',
          uses: 'ai.run',
          with: { capabilities: ['android.tapNormalized'] },
        },
        { id: 'next', uses: 'android.wait', with: { durationMs: 1 } },
      ],
      createState(),
      createRun(),
      { ...stepOptions, isRunCanceled: () => false },
    );
    await dispatch.promise;
    deadline.abort(new DOMException('Task deadline reached.', 'TimeoutError'));
    try {
      await blocked.promise;
      expect(registryExecute).toHaveBeenCalledTimes(2);
      expect(recordActionCompleted).not.toHaveBeenCalled();
    } finally {
      release.resolve();
      await execution;
    }
    expect(registryExecute).toHaveBeenCalledTimes(3);
  });

  it('stops before executing a step when the run is canceled', async () => {
    const { service, registryExecute } = createService();

    const result = await service.executeSteps(
      [{ id: 'tap', uses: 'android.tap', with: { x: 1, y: 2 } }],
      createState(),
      createRun(),
      {
        ...stepOptions,
        isRunCanceled: () => true,
      },
    );

    expect(result).toEqual({ failed: false, stopped: true });
    expect(registryExecute).not.toHaveBeenCalled();
  });

  it('does not dispatch a command if cancellation arrives while recording its start', async () => {
    const cancellation = new AbortController();
    const { service, registryExecute, recordStepFailed } = createService({
      recordActionStarted: jest.fn(async () => cancellation.abort()),
    });
    await expect(
      service.executeSteps(
        [{ id: 'tap', uses: 'android.tap', with: { x: 1, y: 2 } }],
        createState(),
        createRun(),
        {
          ...stepOptions,
          abortSignal: cancellation.signal,
          isRunCanceled: () => false,
        },
      ),
    ).resolves.toEqual({ failed: false, stopped: true });
    expect(registryExecute).not.toHaveBeenCalled();
    expect(recordStepFailed).not.toHaveBeenCalled();
  });

  it('propagates history write failures without recording a command failure', async () => {
    const { service, recordStepFailed } = createService({
      registryExecute: jest.fn().mockResolvedValue({ summary: 'Tapped.' }),
      recordActionCompleted: jest
        .fn()
        .mockRejectedValue(new Error('Write failed.')),
    });
    await expect(
      service.executeSteps(
        [{ id: 'tap', uses: 'android.tap', with: { x: 1, y: 2 } }],
        createState(),
        createRun(),
        { ...stepOptions, isRunCanceled: () => false },
      ),
    ).rejects.toThrow('Write failed.');
    expect(recordStepFailed).not.toHaveBeenCalled();
  });

  it('does not enter a repeat when the run stopped before recording it', async () => {
    const { service, registryExecute } = createService({
      recordRepeatStarted: jest.fn().mockResolvedValue(false),
    });
    await expect(
      service.executeSteps(
        [
          {
            id: 'repeat',
            type: 'repeat',
            count: 1,
            maxIterations: 1,
            steps: [
              { id: 'wait', uses: 'android.wait', with: { durationMs: 1 } },
            ],
          },
        ],
        createState(),
        createRun(),
        { ...stepOptions, isRunCanceled: () => false },
      ),
    ).resolves.toEqual({ failed: false, stopped: true });
    expect(registryExecute).not.toHaveBeenCalled();
  });

  it('executes action steps and records successful output', async () => {
    const registryExecute = jest.fn().mockResolvedValue({
      summary: 'Tapped.',
      data: { touched: true },
    });
    const { service, recordActionStarted, recordActionCompleted } =
      createService({ registryExecute });
    const state = createState();
    const run = createRun();

    const result = await service.executeSteps(
      [{ id: 'tap', uses: 'android.tap', with: { x: 1, y: 2 } }],
      state,
      run,
      {
        ...stepOptions,
        isRunCanceled: () => false,
      },
    );

    expect(result).toEqual({ failed: false, stopped: false });
    expect(registryExecute).toHaveBeenCalledWith(
      'android.tap',
      { x: 1, y: 2 },
      expect.objectContaining({
        app: state.app,
        runId: state.runId,
        ownerUserId: 'user-1',
        stepId: 'tap',
        path: 'steps[0]',
      }),
    );
    const occurrence = expect.objectContaining({
      stepId: 'tap',
      uses: 'android.tap',
      path: 'steps[0]',
      startedAt: expect.any(String),
    });
    expect(recordActionStarted).toHaveBeenCalledWith(run, occurrence);
    expect(recordActionCompleted).toHaveBeenCalledWith(run, state, occurrence, {
      summary: 'Tapped.',
      data: { touched: true },
    });
  });

  it('dispatches fresh AI defaults and preserves explicit capability lists', async () => {
    const registryExecute = jest.fn().mockResolvedValue({ summary: 'Done.' });
    const { service } = createService({ registryExecute });
    const state = { ...createState(), defaultAiCapabilities: ['android.wait'] };
    const prompt = 'Wait for the device';
    await expect(
      service.executeSteps(
        [
          { id: 'default-ai', uses: 'ai.run', with: { prompt } },
          {
            id: 'explicit-ai',
            uses: 'ai.run',
            with: { prompt, capabilities: [] },
          },
        ],
        state,
        createRun(),
        { ...stepOptions, isRunCanceled: () => false },
      ),
    ).resolves.toEqual({ failed: false, stopped: false });
    expect(registryExecute).toHaveBeenNthCalledWith(
      1,
      'ai.run',
      { prompt, capabilities: ['android.wait'] },
      expect.any(Object),
    );
    expect(registryExecute).toHaveBeenNthCalledWith(
      2,
      'ai.run',
      { prompt, capabilities: [] },
      expect.any(Object),
    );
  });

  it('fails closed when an omitted capability list has no grant', async () => {
    const { service, registryExecute } = createService();
    const step = { id: 'default-ai', uses: 'ai.run', with: { prompt: 'Wait' } };
    await expect(
      service.executeSteps([step], createState(), createRun(), {
        ...stepOptions,
        isRunCanceled: () => false,
      }),
    ).resolves.toEqual({ failed: true, stopped: false });
    expect(registryExecute).not.toHaveBeenCalled();
  });

  it('dispatches a grounded AI command with workflow OCR tracing and cancellation', async () => {
    const visionSnapshot = {
      snapshotId: 'screen-1',
    } as AutomationScreenObservation;
    const recordOcrExchange = jest.fn();
    const ocrExchangeRecorder = jest
      .fn()
      .mockReturnValue({ record: recordOcrExchange });
    const { signal } = new AbortController();
    const request = {
      uses: 'vision.locate',
      input: { query: 'Żappka' },
      signal,
      visionSnapshot,
    };
    let canceled = false;
    const registryExecute = jest
      .fn()
      .mockImplementationOnce(
        async (_uses, _input, context: AutomationCommandContext) => {
          const { executeCommand } = context;
          if (!executeCommand) throw new Error('Command dispatch is missing.');
          const result = await executeCommand(request);
          canceled = true;
          await expect(executeCommand(request)).rejects.toThrow(
            'Automation run was canceled.',
          );
          return result;
        },
      )
      .mockResolvedValueOnce({ summary: 'Located Żappka.' });
    const { service } = createService({ registryExecute, ocrExchangeRecorder });
    const state = createState();

    await expect(
      service.executeSteps(
        [
          {
            id: 'agent',
            uses: 'ai.run',
            with: { prompt: 'Find Żappka', capabilities: ['vision.locate'] },
          },
        ],
        state,
        createRun('workflow-1'),
        { ...stepOptions, isRunCanceled: () => canceled },
      ),
    ).resolves.toEqual({ failed: false, stopped: true });
    expect(registryExecute).toHaveBeenCalledTimes(2);
    expect(registryExecute).toHaveBeenNthCalledWith(
      2,
      'vision.locate',
      request.input,
      expect.objectContaining({
        app: state.app,
        abortSignal: signal,
        visionSnapshot,
        recordOcrExchange,
        withTarget: expect.any(Function),
      }),
    );
  });

  it.each(['vision.observe', 'vision.locate'])(
    'releases Android target admission while workflow %s awaits OCR',
    async (uses) => {
      const recognitionStarted = deferred();
      const finishRecognition = deferred();
      const ocr = {
        recognize: jest.fn(async () => {
          recognitionStarted.resolve();
          await finishRecognition.promise;
          return { result: { status: 'available', detections: [] } };
        }),
      };
      const vision = new AutomationVisionService(
        new AutomationVisionCaptureService(ocr as never),
        new AutomationVisionFusionService(),
        {} as never,
      );
      const command = new VisionAutomationCommandsService({} as never, vision)
        .list()
        .find((command) => command.uses === uses)!;
      const tap = jest.fn();
      const registryExecute = jest.fn(
        (name: string, input: unknown, context: AutomationCommandContext) =>
          name === uses ? command.execute(input, context) : tap(),
      );
      const adb = {
        screenshot: jest.fn().mockResolvedValue({
          dataUrl: '',
          mimeType: 'image/png',
          capturedAt: 'now',
        }),
        dumpUi: jest.fn().mockResolvedValue({ status: 'failed' }),
      };
      let admitted = 0;
      let replaced = false;
      const withAutomationTarget: AndroidAppsAutomationPort['withAutomationTarget'] =
        async (target, _signal, operation) => {
          if (replaced) throw new Error('Target runtime changed.');
          admitted++;
          try {
            return await operation(target);
          } finally {
            admitted--;
          }
        };
      const { service, recordStepFailed } = createService({
        registryExecute,
        withAutomationTarget,
        adb,
      });
      const execution = service.executeSteps(
        [
          {
            id: 'vision',
            uses,
            with: uses === 'vision.locate' ? { query: 'Settings' } : {},
          },
          { id: 'tap', uses: 'android.tap', with: { x: 0.5, y: 0.5 } },
        ],
        createState(),
        createRun(),
        { ...stepOptions, isRunCanceled: () => false },
      );
      await recognitionStarted.promise;
      try {
        expect(adb.dumpUi).toHaveBeenCalledTimes(1);
        expect(admitted).toBe(0);
        replaced = true;
      } finally {
        finishRecognition.resolve();
        await execution;
      }
      await expect(execution).resolves.toEqual({
        failed: true,
        stopped: false,
      });
      expect(recordStepFailed).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({ stepId: 'tap' }),
        'Target runtime changed.',
        undefined,
      );
      expect(tap).not.toHaveBeenCalled();
    },
  );
});
