import { DEVICE_DECISION_TOOL_NAME } from './core/device-decision';
import { AutomationAiActionExecutor } from './automation-ai-action-executor.service';
import { AutomationAiDecisionService } from './automation-ai-decision.service';
import { AutomationAiHarnessService } from './automation-ai-harness.service';
import type { AutomationAiHarnessContext } from './automation-ai.types';
import type { AutomationRunEventInput } from '../events/automation-run-events.types';
import { VisionAutomationCommandsService } from '../commands/vision-automation-commands.service';
import { AutomationVisionService } from '../vision/automation-vision.service';
import { createDetection } from '../vision/vision-observation';

const provider = {
  id: 'provider',
  label: 'Provider',
  kind: 'openai-compatible' as const,
  protocol: 'openai-chat-completions' as const,
  baseUrl: 'http://localhost:8080/v1',
  enabled: true,
  models: [],
};

const model = {
  id: 'controller',
  label: 'Controller',
  roles: ['controller' as const, 'planner' as const],
  settings: { thinkingMode: 'bounded' as const },
  enabled: true,
  defaultFor: ['controller' as const, 'planner' as const],
};

const decisionResponse = (decision: Record<string, unknown>) => ({
  choices: [
    {
      message: {
        role: 'assistant' as const,
        content: null,
        tool_calls: [
          {
            id: 'decision',
            type: 'function' as const,
            function: {
              name: DEVICE_DECISION_TOOL_NAME,
              arguments: JSON.stringify(decision),
            },
          },
        ],
      },
    },
  ],
  generation: {
    reasoningPresent: true,
    finishReason: 'tool_calls',
    usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
    timings: null,
    protocol: 'openai-chat-completions' as const,
  },
});

const planResponse = (subgoals: Array<Record<string, unknown>>) => ({
  choices: [
    {
      message: {
        role: 'assistant' as const,
        content: null,
        tool_calls: [
          {
            id: 'plan',
            type: 'function' as const,
            function: {
              name: 'submit_device_plan',
              arguments: JSON.stringify({ subgoals }),
            },
          },
        ],
      },
    },
  ],
});

const observation = (snapshotId: string, image = snapshotId) => ({
  plannerText: [
    `snapshotId=${snapshotId}`,
    'screen=1080x2340',
    'Candidates (use IDs for taps):',
    '- candidate-1 | Settings | source=ocr | confidence=0.9 | bounds=0.1,0.2,0.2,0.1',
  ].join('\n'),
  observation: {
    snapshotId,
    image: {
      width: 1080,
      height: 2340,
      capturedAt: snapshotId,
      mimeType: 'image/png',
      source: 'screenshot' as const,
    },
    aiImage: {
      dataUrl: `data:image/jpeg;base64,${image}`,
      mimeType: 'image/jpeg',
      capturedAt: snapshotId,
      optimized: true,
      originalBytes: 1,
      bytes: 1,
      width: 1080,
      height: 2340,
      renderedWidth: 332,
      renderedHeight: 720,
    },
    detections: [],
    candidates: [
      {
        id: 'candidate-1',
        label: 'Settings',
        source: 'ocr' as const,
        confidence: 0.9,
        bounds: { left: 0.1, top: 0.2, width: 0.2, height: 0.1 },
      },
    ],
    markedScreenshotId: `som-${snapshotId}`,
  },
});

const createHarness = ({
  chatResponses,
  observations = [observation('screen-1')],
  commandUses = ['android.listPackages'],
}: {
  chatResponses: Array<
    ReturnType<typeof decisionResponse> | ReturnType<typeof planResponse>
  >;
  observations?: Array<ReturnType<typeof observation> | Error>;
  commandUses?: string[];
}) => {
  const events: AutomationRunEventInput[] = [];
  const chat = jest.fn().mockResolvedValue(
    decisionResponse({
      kind: 'finish',
      status: 'blocked',
      finalText: 'No further action available.',
      evidenceIds: [],
      completedSubgoalIds: [],
    }),
  );
  for (const response of chatResponses) chat.mockResolvedValueOnce(response);
  const perception = jest.fn();
  for (const value of observations) {
    if (value instanceof Error) perception.mockRejectedValueOnce(value);
    else perception.mockResolvedValueOnce(value);
  }
  const eventBus = {
    emit: jest.fn(async (event: AutomationRunEventInput) => {
      events.push(event);
      return {
        ...event,
        id: `event-${events.length}`,
        sequence: events.length,
      };
    }),
  };
  const decisions = new AutomationAiDecisionService(
    { chat } as never,
    eventBus as never,
  );
  const actions = new AutomationAiActionExecutor(
    eventBus as never,
    { observe: perception } as never,
  );
  const service = new AutomationAiHarnessService(
    { getProvider: jest.fn().mockResolvedValue({ provider, model }) } as never,
    {
      listCommands: jest.fn().mockReturnValue(
        commandUses.map((uses) => ({
          uses,
          label: uses,
          description: uses,
          requiredPermissions: ['automations:run'],
          inputSchema: { type: 'object', properties: {} },
        })),
      ),
    } as never,
    eventBus as never,
    decisions,
    actions,
    { observe: perception } as never,
  );
  return { service, events, chat, perception };
};

const context = (executeCommand = jest.fn()): AutomationAiHarnessContext => ({
  runId: 'run-1',
  ownerUserId: 'owner-1',
  stepId: 'ai-run',
  app: {
    id: 'app-1',
    containerId: 'container-1',
    containerName: 'rebroid-app-1',
    networkName: 'rebroid-network-1',
    adbPort: 5555,
  } as never,
  adb: {} as never,
  executeCommand,
  withTarget: jest.fn(),
});

const input = {
  prompt: 'Open Settings.',
  agentMode: 'controller' as const,
  maxActions: 4,
  timeoutMs: 30_000,
  rawShellPolicy: 'deny' as const,
};

describe('AutomationAiHarnessService', () => {
  it('grounds an OCR lookup outside the initial shortlist and rejects its ID after a new snapshot', async () => {
    const initial = observation('screen-1');
    const current = {
      ...initial,
      observation: {
        ...initial.observation,
        lookupDetections: [
          createDetection({
            id: 'ocr-31',
            label: 'Żappka',
            text: 'Żappka',
            source: 'ocr',
            confidence: 0.8,
            bounds: { left: 0.25, top: 0.5, width: 0.25, height: 0.25 },
          }),
        ],
        ocr: { status: 'available' as const, detections: [] },
      },
    };
    const capture = jest.fn();
    const vision = new AutomationVisionService(
      { capture } as never,
      {} as never,
      {} as never,
    );
    const [, locate] = new VisionAutomationCommandsService(
      {} as never,
      vision,
    ).list();
    const { service, chat, events, perception } = createHarness({
      commandUses: ['vision.locate'],
      observations: [current, observation('screen-2')],
      chatResponses: [
        decisionResponse({
          kind: 'act',
          snapshotId: 'screen-1',
          intent: 'Locate Żappka',
          expectedOutcome: 'A candidate is located.',
          action: {
            type: 'invoke_capability',
            uses: 'vision.locate',
            input: { query: 'Żappka' },
          },
        }),
        decisionResponse({
          kind: 'act',
          snapshotId: 'screen-1',
          intent: 'Open Żappka',
          expectedOutcome: 'The screen changes.',
          action: { type: 'tap', candidateId: 'lookup-1-1' },
        }),
        decisionResponse({
          kind: 'act',
          snapshotId: 'screen-2',
          intent: 'Repeat the tap',
          expectedOutcome: 'The screen changes.',
          action: { type: 'tap', candidateId: 'lookup-1-1' },
        }),
        decisionResponse({
          kind: 'finish',
          status: 'completed',
          finalText: 'Żappka was opened.',
          evidenceIds: ['action:2'],
          completedSubgoalIds: [],
        }),
      ],
    });
    const executeCommand = jest
      .fn()
      .mockImplementationOnce(({ input, signal, visionSnapshot }) =>
        locate.execute(input, {
          abortSignal: signal,
          visionSnapshot,
        } as never),
      )
      .mockResolvedValueOnce({ summary: 'Tapped Żappka.' });
    const result = await service.run(
      { ...input, capabilities: ['vision.locate', 'android.tapNormalized'] },
      context(executeCommand),
    );
    expect(result.data.status).toBe('completed');
    expect(capture).not.toHaveBeenCalled();
    expect(perception).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(chat.mock.calls[1]?.[0].messages)).toContain(
      'lookup-1-1',
    );
    expect(JSON.stringify(chat.mock.calls[1]?.[0].messages)).toContain(
      'Żappka',
    );
    expect(executeCommand).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        uses: 'android.tapNormalized',
        input: { x: 0.375, y: 0.625 },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(executeCommand).toHaveBeenCalledTimes(2);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'ai.guardrail.triggered',
        message: 'Tap target is missing or stale.',
      }),
    );
  });

  it('uses a single planner tool when structured output is not declared', async () => {
    const { service, chat } = createHarness({
      chatResponses: [
        planResponse([
          {
            id: 'open-settings',
            goal: 'Open Settings',
            successEvidence: 'A fresh snapshot shows Settings.',
          },
        ]),
        decisionResponse({
          kind: 'finish',
          status: 'completed',
          finalText: 'Settings is already open.',
          evidenceIds: ['snapshot:screen-1'],
          completedSubgoalIds: ['open-settings'],
        }),
      ],
    });

    const result = await service.run(
      { ...input, agentMode: 'planned' },
      context(),
    );

    expect(chat.mock.calls[0]?.[0]).toMatchObject({
      tools: [
        {
          function: { name: 'submit_device_plan' },
        },
      ],
    });
    expect(chat.mock.calls[0]?.[0]).not.toHaveProperty('responseFormat');
    expect(result.data.status).toBe('completed');
  });

  it('executes one snapshot-grounded action and verifies completion evidence', async () => {
    const { service, events, chat } = createHarness({
      observations: [
        observation('screen-1', 'before'),
        observation('screen-2', 'after'),
      ],
      chatResponses: [
        decisionResponse({
          kind: 'act',
          snapshotId: 'screen-1',
          intent: 'Open Settings',
          expectedOutcome: 'Settings screen is visible',
          action: { type: 'tap', candidateId: 'candidate-1' },
        }),
        decisionResponse({
          kind: 'finish',
          status: 'completed',
          finalText: 'Settings is open.',
          evidenceIds: ['action:1'],
          completedSubgoalIds: [],
        }),
      ],
    });
    const executeCommand = jest.fn().mockResolvedValue({
      summary: 'Tapped Settings.',
      data: { x: 216, y: 585 },
    });

    const result = await service.run(
      { ...input, maxActions: 1 },
      context(executeCommand),
    );

    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        uses: 'android.tapNormalized',
        input: { x: 0.2, y: 0.25 },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.data).toMatchObject({
      status: 'completed',
      completed: true,
      toolCalls: 1,
      evidence: { evidenceIds: ['action:1'] },
    });
    expect(events.some((event) => event.type === 'ai.tool.completed')).toBe(
      true,
    );
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it('rejects an action bound to a stale snapshot before tool execution', async () => {
    const { service, events } = createHarness({
      chatResponses: [
        decisionResponse({
          kind: 'act',
          snapshotId: 'screen-old',
          intent: 'Tap target',
          expectedOutcome: 'Target opens',
          action: { type: 'tap', candidateId: 'candidate-1' },
        }),
        decisionResponse({
          kind: 'finish',
          status: 'blocked',
          finalText: 'The snapshot was stale.',
          reason: 'A fresh grounded action is required.',
          evidenceIds: ['snapshot:screen-1'],
          completedSubgoalIds: [],
        }),
      ],
    });
    const executeCommand = jest.fn();

    const result = await service.run(input, context(executeCommand));

    expect(executeCommand).not.toHaveBeenCalled();
    expect(result.data.status).toBe('blocked');
    expect(
      events.some(
        (event) =>
          event.type === 'ai.guardrail.triggered' &&
          event.message?.includes('Stale snapshot'),
      ),
    ).toBe(true);
  });

  it.each([
    ['android.tap', { x: 216, y: 585 }],
    ['android.tapText', { text: 'Settings' }],
  ])('keeps %s out of AI capability routing', async (uses, toolInput) => {
    const { service, events, chat } = createHarness({
      commandUses: [uses],
      chatResponses: [
        decisionResponse({
          kind: 'act',
          snapshotId: 'screen-1',
          intent: 'Tap Settings',
          expectedOutcome: 'Settings opens',
          action: { type: 'invoke_capability', uses, input: toolInput },
        }),
      ],
    });
    const executeCommand = jest.fn();

    await service.run(
      { ...input, capabilities: [uses], maxActions: 1 },
      context(executeCommand),
    );

    expect(JSON.stringify(chat.mock.calls[0]?.[0])).not.toContain(`${uses}:`);
    expect(executeCommand).not.toHaveBeenCalled();
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'ai.guardrail.triggered',
        message: `Capability ${uses} was not routed into this run.`,
      }),
    );
  });

  it('observes after a routed screen mutation even when dispatch rejects', async () => {
    const uses = 'android.rotateDisplay';
    const { service, chat, perception, events } = createHarness({
      commandUses: [uses],
      observations: [observation('screen-1'), observation('screen-2')],
      chatResponses: [
        decisionResponse({
          kind: 'act',
          snapshotId: 'screen-1',
          intent: 'Rotate the display',
          expectedOutcome: 'The screen is in landscape',
          action: {
            type: 'invoke_capability',
            uses,
            input: { orientation: 'landscape' },
          },
        }),
        decisionResponse({
          kind: 'finish',
          status: 'completed',
          finalText: 'The rotation result was unavailable.',
          evidenceIds: ['action:1'],
          completedSubgoalIds: [],
        }),
      ],
    });
    const executeCommand = jest
      .fn()
      .mockRejectedValue(new Error('Lost response'));

    const result = await service.run(
      { ...input, capabilities: [uses] },
      context(executeCommand),
    );

    expect(result.data.status).toBe('blocked');
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'ai.guardrail.triggered',
        message: 'Completed status requires observed evidence.',
      }),
    );
    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ uses, signal: expect.any(AbortSignal) }),
    );
    expect(perception).toHaveBeenCalledWith(
      expect.objectContaining({ reason: `after:${uses}` }),
    );
    expect(JSON.stringify(chat.mock.calls[1]?.[0])).toContain(
      'snapshotId=screen-2',
    );
  });

  it('does not dispatch a decision received after its deadline', async () => {
    const { service, chat } = createHarness({ chatResponses: [] });
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    chat.mockImplementationOnce(async () => {
      now.mockReturnValue(3000);
      return decisionResponse({
        kind: 'act',
        snapshotId: 'screen-1',
        intent: 'Wait',
        expectedOutcome: 'Pause',
        action: { type: 'wait', durationMs: 1000 },
      });
    });
    const executeCommand = jest.fn();
    try {
      const result = await service.run(
        { ...input, timeoutMs: 1000 },
        context(executeCommand),
      );
      expect(result.data).toMatchObject({
        status: 'blocked',
        blockedReason: 'Agent timeout reached.',
      });
      expect(executeCommand).not.toHaveBeenCalled();
    } finally {
      now.mockRestore();
    }
  });

  it('blocks further actions when a dispatched tap cannot be observed', async () => {
    const tap = decisionResponse({
      kind: 'act',
      snapshotId: 'screen-1',
      intent: 'Open Settings',
      expectedOutcome: 'Settings screen is visible',
      action: { type: 'tap', candidateId: 'candidate-1' },
    });
    const { service, chat, events } = createHarness({
      observations: [observation('screen-1'), new Error('Capture failed')],
      chatResponses: [tap, tap],
    });
    const executeCommand = jest
      .fn()
      .mockResolvedValue({ summary: 'Tapped Settings.' });

    const result = await service.run(input, context(executeCommand));

    expect(result.data).toMatchObject({
      status: 'blocked',
      blockedReason: 'A fresh screen observation is unavailable.',
      toolCalls: 1,
    });
    expect(chat).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'ai.tool.failed',
        message: 'Capture failed',
      }),
    );
  });

  it('keeps raw ADB shell hidden when escalation is not enabled', async () => {
    const { service, events } = createHarness({
      chatResponses: [
        decisionResponse({
          kind: 'request_escalation',
          reason: 'Inspect a system property',
          program: 'getprop',
          args: ['ro.build.version.release'],
        }),
        decisionResponse({
          kind: 'finish',
          status: 'blocked',
          finalText: 'Shell access is disabled.',
          reason: 'The required typed capability is unavailable.',
          evidenceIds: ['snapshot:screen-1'],
          completedSubgoalIds: [],
        }),
      ],
    });
    const executeCommand = jest.fn();

    await service.run(input, context(executeCommand));

    expect(executeCommand).not.toHaveBeenCalled();
    expect(
      events.some(
        (event) =>
          event.type === 'ai.guardrail.triggered' &&
          event.message?.includes('disabled'),
      ),
    ).toBe(true);
  });

  it('records an unchanged screen as a failed action', async () => {
    const { service, events } = createHarness({
      observations: [
        observation('screen-1', 'same-image'),
        observation('screen-2', 'same-image'),
      ],
      chatResponses: [
        decisionResponse({
          kind: 'act',
          snapshotId: 'screen-1',
          intent: 'Open Settings',
          expectedOutcome: 'Settings screen is visible',
          action: { type: 'tap', candidateId: 'candidate-1' },
        }),
        decisionResponse({
          kind: 'finish',
          status: 'blocked',
          finalText: 'The screen did not change.',
          reason: 'The action could not be verified.',
          evidenceIds: ['action:1'],
          completedSubgoalIds: [],
        }),
      ],
    });
    const executeCommand = jest.fn().mockResolvedValue({
      summary: 'Tapped Settings.',
      data: { x: 216, y: 585 },
    });

    await service.run(input, context(executeCommand));

    expect(
      events.some(
        (event) =>
          event.type === 'ai.tool.failed' &&
          event.message?.includes('Screen did not change'),
      ),
    ).toBe(true);
  });

  it('stops at the action budget after a structured command failure', async () => {
    const { service, events, chat } = createHarness({
      chatResponses: [
        decisionResponse({
          kind: 'act',
          snapshotId: 'screen-1',
          intent: 'List packages',
          expectedOutcome: 'Installed packages are returned',
          action: {
            type: 'invoke_capability',
            uses: 'android.listPackages',
            input: {},
          },
        }),
      ],
    });
    const executeCommand = jest.fn().mockResolvedValue({
      summary: 'Package query failed.',
      data: { success: false },
    });

    const result = await service.run(
      { ...input, maxActions: 1 },
      context(executeCommand),
    );

    expect(result.data).toMatchObject({ status: 'blocked', toolCalls: 1 });
    expect(chat).toHaveBeenCalledTimes(2);
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(events.some((event) => event.type === 'ai.tool.failed')).toBe(true);
  });

  it('executes only an approved allowlisted shell escalation', async () => {
    const { service } = createHarness({
      chatResponses: [
        decisionResponse({
          kind: 'request_escalation',
          reason: 'Inspect the Android release',
          program: 'getprop',
          args: ['ro.build.version.release'],
        }),
        decisionResponse({
          kind: 'finish',
          status: 'completed',
          finalText: 'Android release inspected.',
          evidenceIds: ['action:1'],
          completedSubgoalIds: [],
        }),
      ],
    });
    const executeCommand = jest.fn().mockResolvedValue({
      summary: 'Android 14',
      data: { output: '14' },
    });

    await service.run(
      { ...input, rawShellPolicy: 'allowlisted' },
      context(executeCommand),
    );

    expect(executeCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        uses: 'android.adbShell',
        input: {
          command: 'getprop ro.build.version.release',
          timeoutMs: 10_000,
        },
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
