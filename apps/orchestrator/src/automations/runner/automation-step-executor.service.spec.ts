import { AutomationRunTrigger } from '../entities/automation-run.entity';
import { AutomationStepExecutorService } from './automation-step-executor.service';
import type { AutomationExecutionState } from './automation-runner-execution.types';

const createService = ({
  registryExecute = jest.fn(),
  recordActionStarted = jest.fn(),
  recordActionCompleted = jest.fn(),
  recordStepFailed = jest.fn(),
  recordControlCompleted = jest.fn(),
  evaluate = jest.fn(),
  resolveValueRef = jest.fn(),
} = {}) => {
  const service = new AutomationStepExecutorService(
    { execute: registryExecute } as never,
    {} as never,
    {
      recordActionStarted,
      recordActionCompleted,
      recordStepFailed,
      recordControlCompleted,
    } as never,
    { evaluate, resolveValueRef } as never,
    {
      automationAdapters: () => ({ adb: {}, display: {}, networkPolicy: {} }),
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
  canUseInternet: false,
  runId: 'run-1',
  trigger: AutomationRunTrigger.Manual,
  targetProfileMode: null,
  targetProfileName: null,
  results: [],
  outputsByStepId: new Map(),
});

const createRun = () =>
  ({
    id: 'run-1',
    ownerUserId: 'user-1',
  }) as never;

describe('AutomationStepExecutorService', () => {
  it('stops before executing a step when the run is canceled', async () => {
    const { service, registryExecute } = createService();

    const result = await service.executeSteps(
      [{ id: 'tap', uses: 'android.tap', with: { x: 1, y: 2 } }],
      createState(),
      createRun(),
      {
        path: 'steps',
        isRunCanceled: () => true,
      },
    );

    expect(result).toEqual({ failed: false, stopped: true });
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
        path: 'steps',
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
    expect(recordActionStarted).toHaveBeenCalledWith(
      run,
      state,
      'tap',
      'android.tap',
      expect.objectContaining({ path: 'steps[0]' }),
    );
    expect(recordActionCompleted).toHaveBeenCalledWith(
      run,
      state,
      'tap',
      'android.tap',
      expect.objectContaining({ path: 'steps[0]' }),
      expect.any(String),
      { summary: 'Tapped.', data: { touched: true } },
    );
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
        { path: 'steps', isRunCanceled: () => false },
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
        path: 'steps',
        isRunCanceled: () => false,
      }),
    ).resolves.toEqual({ failed: true, stopped: false });
    expect(registryExecute).not.toHaveBeenCalled();
  });
});
