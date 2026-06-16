import { AutomationAiHarnessService } from './automation-ai-harness.service';
import type { AutomationAiHarnessContext } from './automation-ai.types';
import type { AutomationRunEventInput } from '../events/automation-run-events.types';
import { BadRequestException } from '@nestjs/common';

describe('AutomationAiHarnessService', () => {
  it('continues when the model returns a plan-shaped no-tool response', async () => {
    const events: AutomationRunEventInput[] = [];
    const provider = {
      id: 'provider',
      label: 'Provider',
      kind: 'ollama' as const,
      baseUrl: 'http://localhost:11434',
      enabled: true,
      models: [],
    };
    const model = {
      id: 'planner',
      label: 'Planner',
      roles: ['planner' as const],
      settings: {},
      enabled: true,
      defaultFor: ['planner'],
    };
    const chat = jest
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: [
                'Current screen: Home',
                'Goal: Inspect packages',
                'Next moves: Use typed package discovery',
              ].join('\n'),
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: [
                'Current screen: Home',
                'Goal: Inspect packages',
                'Attempted: Opened Settings app.',
                'Remaining: No further tool actions possible.',
              ].join('\n'),
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'android__listPackages',
                    arguments: JSON.stringify({
                      intent: 'List packages',
                      expectedOutcome: 'Installed packages are returned',
                      input: {},
                    }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Package list was inspected.',
            },
          },
        ],
      });
    const service = new AutomationAiHarnessService(
      {
        getProvider: jest.fn().mockResolvedValue({ provider, model }),
      } as never,
      {
        listAiCommands: jest.fn().mockReturnValue([
          {
            uses: 'android.listPackages',
            label: 'List packages',
            description: 'List installed Android packages.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
          },
        ]),
      } as never,
      {
        emit: jest.fn(async (event: AutomationRunEventInput) => {
          events.push(event);
          return {
            ...event,
            id: `event_${events.length}`,
            sequence: events.length,
          };
        }),
      } as never,
      {
        observe: jest.fn().mockResolvedValue({
          plannerText: 'Screen captured: 0 UI hierarchy element(s) detected.',
          observation: {
            image: { width: 1080, height: 2340 },
            uiXml: { status: 'empty', nodeCount: 0 },
            detections: [],
            summary: 'Home screen',
          },
        }),
      } as never,
      {
        buildForPlanner: jest.fn().mockResolvedValue('Runtime context'),
      } as never,
      { chat } as never,
    );
    const toolExecutor = jest.fn().mockResolvedValue({
      summary: 'Packages listed.',
      data: { packages: ['com.android.settings'] },
    });
    const context: AutomationAiHarnessContext = {
      runId: 'run_1',
      ownerUserId: 'user_1',
      stepId: 'step_1',
      parentStepId: null,
      path: '$',
      app: {} as never,
      adb: {} as never,
      display: {} as never,
      networkPolicy: {} as never,
      toolExecutor,
    };

    await service.run(
      {
        prompt: 'Inspect packages',
        maxToolCalls: 3,
        timeoutMs: 30_000,
        allowedTools: ['android.listPackages'],
        requireFinalAnswer: true,
      },
      context,
    );

    const toolCompletedIndex = events.findIndex(
      (event) => event.type === 'ai.tool.completed',
    );
    const finalIndex = events.findIndex(
      (event) => event.type === 'ai.message.completed',
    );

    expect(toolExecutor).toHaveBeenCalledTimes(1);
    expect(chat).toHaveBeenCalledTimes(4);
    expect(events.some((event) => event.type === 'ai.plan.updated')).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === 'ai.guardrail.triggered' &&
          (event.message ?? '').includes('before calling any tool'),
      ),
    ).toBe(true);
    expect(toolCompletedIndex).toBeGreaterThan(-1);
    expect(finalIndex).toBeGreaterThan(toolCompletedIndex);
  });

  it('recovers when the provider rejects malformed tool-call JSON', async () => {
    const events: AutomationRunEventInput[] = [];
    const provider = {
      id: 'provider',
      label: 'Provider',
      kind: 'ollama' as const,
      baseUrl: 'http://localhost:11434',
      enabled: true,
      models: [],
    };
    const model = {
      id: 'planner',
      label: 'Planner',
      roles: ['planner' as const],
      settings: {},
      enabled: true,
      defaultFor: ['planner'],
    };
    const chat = jest
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Current screen: Home\nGoal: Open Settings',
            },
          },
        ],
      })
      .mockRejectedValueOnce(
        new BadRequestException(
          'AI provider request failed: 500 Internal Server Error - error parsing tool call: raw="", err=unexpected end of JSON input',
        ),
      )
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'android__launchPackage',
                    arguments: JSON.stringify({
                      intent: 'Open Android Settings',
                      expectedOutcome: 'Settings screen opens',
                      input: { packageName: 'com.android.settings' },
                    }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Current screen: Settings\nGoal: Open Settings',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Settings was opened.',
            },
          },
        ],
      });
    const service = new AutomationAiHarnessService(
      {
        getProvider: jest.fn().mockResolvedValue({ provider, model }),
      } as never,
      {
        listAiCommands: jest.fn().mockReturnValue([
          {
            uses: 'android.launchPackage',
            label: 'Launch package',
            description: 'Launch package.',
            inputSchema: {
              type: 'object',
              properties: { packageName: { type: 'string' } },
              required: ['packageName'],
              additionalProperties: false,
            },
          },
        ]),
      } as never,
      {
        emit: jest.fn(async (event: AutomationRunEventInput) => {
          events.push(event);
          return {
            ...event,
            id: `event_${events.length}`,
            sequence: events.length,
          };
        }),
      } as never,
      {
        observe: jest.fn().mockResolvedValue({
          plannerText: 'Screen captured: 0 UI hierarchy element(s) detected.',
          observation: {
            image: { width: 1080, height: 2340 },
            uiXml: { status: 'empty', nodeCount: 0 },
            detections: [],
            summary: 'Home screen',
          },
        }),
      } as never,
      {
        buildForPlanner: jest.fn().mockResolvedValue('Runtime context'),
      } as never,
      { chat } as never,
    );
    const toolExecutor = jest.fn().mockResolvedValue({
      summary: 'Settings launched.',
      data: { launched: true },
    });
    const context: AutomationAiHarnessContext = {
      runId: 'run_1',
      ownerUserId: 'user_1',
      stepId: 'step_1',
      parentStepId: null,
      path: '$',
      app: {} as never,
      adb: {} as never,
      display: {} as never,
      networkPolicy: {} as never,
      toolExecutor,
    };

    await service.run(
      {
        prompt: 'Open Settings',
        maxToolCalls: 3,
        timeoutMs: 30_000,
        allowedTools: ['android.launchPackage'],
        requireFinalAnswer: true,
      },
      context,
    );

    expect(toolExecutor).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'android.launchPackage',
        arguments: { packageName: 'com.android.settings' },
      }),
    );
    expect(
      events.some(
        (event) =>
          event.type === 'ai.guardrail.triggered' &&
          (event.message ?? '').includes('malformed tool-call JSON'),
      ),
    ).toBe(true);
  });

  it('blocks tapText when the latest UI hierarchy is empty', async () => {
    const events: AutomationRunEventInput[] = [];
    const provider = {
      id: 'provider',
      label: 'Provider',
      kind: 'ollama' as const,
      baseUrl: 'http://localhost:11434',
      enabled: true,
      models: [],
    };
    const model = {
      id: 'planner',
      label: 'Planner',
      roles: ['planner' as const],
      settings: {},
      enabled: true,
      defaultFor: ['planner'],
    };
    const chat = jest
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Current screen: Home\nGoal: Tap Display',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'android__tapText',
                    arguments: JSON.stringify({
                      intent: 'Tap Display',
                      expectedOutcome: 'Display text opens',
                      input: { text: 'Display' },
                    }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content:
                'Current screen: Home\nGoal: Tap Display\nNext moves: Use another route',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content:
                'The UI hierarchy is unavailable, so text tapping was not attempted.',
            },
          },
        ],
      });
    const service = new AutomationAiHarnessService(
      {
        getProvider: jest.fn().mockResolvedValue({ provider, model }),
      } as never,
      {
        listAiCommands: jest.fn().mockReturnValue([
          {
            uses: 'android.tapText',
            label: 'Tap text',
            description: 'Tap visible text.',
            inputSchema: {
              type: 'object',
              properties: { text: { type: 'string' } },
              required: ['text'],
              additionalProperties: false,
            },
          },
        ]),
      } as never,
      {
        emit: jest.fn(async (event: AutomationRunEventInput) => {
          events.push(event);
          return {
            ...event,
            id: `event_${events.length}`,
            sequence: events.length,
          };
        }),
      } as never,
      {
        observe: jest.fn().mockResolvedValue({
          plannerText:
            'UI hierarchy: empty, 0 node(s). Vision hypothesis: unavailable.',
          observation: {
            image: { width: 1080, height: 2340 },
            uiXml: { status: 'empty', nodeCount: 0 },
            detections: [],
          },
        }),
      } as never,
      {
        buildForPlanner: jest.fn().mockResolvedValue('Runtime context'),
      } as never,
      { chat } as never,
    );
    const toolExecutor = jest.fn();
    const context: AutomationAiHarnessContext = {
      runId: 'run_1',
      ownerUserId: 'user_1',
      stepId: 'step_1',
      parentStepId: null,
      path: '$',
      app: {} as never,
      adb: {} as never,
      display: {} as never,
      networkPolicy: {} as never,
      toolExecutor,
    };

    await service.run(
      {
        prompt: 'Tap Display',
        maxToolCalls: 3,
        timeoutMs: 30_000,
        allowedTools: ['android.tapText'],
        requireFinalAnswer: true,
      },
      context,
    );

    expect(toolExecutor).not.toHaveBeenCalled();
    expect(
      events.some(
        (event) =>
          event.type === 'ai.guardrail.triggered' &&
          (event.message ?? '').includes('UI text lookup is unavailable'),
      ),
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === 'ai.tool.failed' &&
          event.data?.failureCategory === 'no_match',
      ),
    ).toBe(true);
  });

  it('keeps structured perception in shared multimodal mode and feeds visual affordances to replanning', async () => {
    const events: AutomationRunEventInput[] = [];
    const provider = {
      id: 'provider',
      label: 'Provider',
      kind: 'ollama' as const,
      baseUrl: 'http://localhost:11434',
      enabled: true,
      models: [],
    };
    const model = {
      id: 'dual',
      label: 'Dual',
      roles: ['planner' as const, 'vision' as const],
      settings: {},
      enabled: true,
      defaultFor: ['planner' as const, 'vision' as const],
    };
    const chat = jest
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content:
                'Current screen: Home\nGoal: Open quick settings\nNext moves: expand quick settings',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'android__expandQuickSettings',
                    arguments: JSON.stringify({
                      intent: 'Expand quick settings',
                      expectedOutcome:
                        'Quick settings panel and controls are visible.',
                      input: {},
                    }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content:
                'Current screen: Quick settings\nGoal: Open quick settings\nNext moves: inspect settings access candidate',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Quick panel is open.',
            },
          },
        ],
      });
    const observe = jest
      .fn()
      .mockResolvedValueOnce({
        plannerText: 'Screen observation: home.',
        observation: {
          image: { width: 1080, height: 2340 },
          aiImage: { dataUrl: 'data:image/png;base64,initial' },
          uiXml: { status: 'failed', nodeCount: 0 },
          detections: [],
          summary: 'Home screen',
          screenState: {
            screenKind: 'home',
            confidence: 0.7,
            visibleText: [],
            controls: [],
            evidence: [],
            uncertainty: [],
            summary: 'Home screen.',
          },
        },
      })
      .mockResolvedValueOnce({
        plannerText: 'Screen observation: quick settings.',
        observation: {
          image: { width: 1080, height: 2340 },
          aiImage: { dataUrl: 'data:image/png;base64,after' },
          uiXml: { status: 'failed', nodeCount: 0 },
          detections: [],
          summary: 'Quick settings panel with gear access.',
          screenState: {
            screenKind: 'quick_settings',
            confidence: 0.82,
            visibleText: ['Internet', 'Bluetooth'],
            controls: [
              {
                label: 'Settings access gear',
                role: 'icon',
                confidence: 0.8,
                bounds: { left: 0.88, top: 0.84, width: 0.08, height: 0.08 },
              },
            ],
            evidence: ['Quick settings tiles and settings gear are visible.'],
            uncertainty: [],
            summary: 'Quick settings panel.',
            settingsAccessVisible: true,
          },
        },
      });
    const service = new AutomationAiHarnessService(
      {
        getProvider: jest.fn().mockResolvedValue({ provider, model }),
      } as never,
      {
        listAiCommands: jest.fn().mockReturnValue([
          {
            uses: 'android.expandQuickSettings',
            label: 'Expand quick settings',
            description: 'Expand Android quick settings.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
          },
        ]),
      } as never,
      {
        emit: jest.fn(async (event: AutomationRunEventInput) => {
          events.push(event);
          return {
            ...event,
            id: `event_${events.length}`,
            sequence: events.length,
          };
        }),
      } as never,
      { observe } as never,
      {
        buildForPlanner: jest.fn().mockResolvedValue('Runtime context'),
      } as never,
      { chat } as never,
    );
    const toolExecutor = jest.fn().mockResolvedValue({
      summary: 'Expanded quick settings.',
      data: {},
    });
    const context: AutomationAiHarnessContext = {
      runId: 'run_1',
      ownerUserId: 'user_1',
      stepId: 'step_1',
      parentStepId: null,
      path: '$',
      app: {} as never,
      adb: {} as never,
      display: {} as never,
      networkPolicy: {} as never,
      toolExecutor,
    };

    await service.run(
      {
        prompt: 'Open quick settings',
        maxToolCalls: 3,
        timeoutMs: 30_000,
        allowedTools: ['android.expandQuickSettings'],
        requireFinalAnswer: true,
        providerId: 'provider',
        modelId: 'dual',
        visionProviderId: 'provider',
        visionModelId: 'dual',
      },
      context,
    );

    expect(observe).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          visionProviderId: 'provider',
          visionModelId: 'dual',
        }),
      }),
    );
    expect(
      events.some(
        (event) =>
          event.type === 'ai.guardrail.triggered' &&
          event.data?.failureCategory === 'no_effect',
      ),
    ).toBe(false);
    expect(
      JSON.stringify(chat.mock.calls).includes(
        'Visual affordances are hypotheses',
      ),
    ).toBe(true);
    expect(
      JSON.stringify(chat.mock.calls).includes('data:image/png;base64,after'),
    ).toBe(true);
  });

  it('blocks quick controls from app drawer when the goal is opening Settings', async () => {
    const events: AutomationRunEventInput[] = [];
    const provider = {
      id: 'provider',
      label: 'Provider',
      kind: 'ollama' as const,
      baseUrl: 'http://localhost:11434',
      enabled: true,
      models: [],
    };
    const model = {
      id: 'planner',
      label: 'Planner',
      roles: ['planner' as const],
      settings: {},
      enabled: true,
      defaultFor: ['planner'],
    };
    const chat = jest
      .fn()
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content:
                'Current screen: App drawer\nGoal: Open Android Settings\nNext moves: find Settings app',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'android_openQuickControlsPanel',
                    arguments: JSON.stringify({
                      intent: 'Open quick controls',
                      expectedOutcome: 'Quick controls are visible',
                      input: {},
                    }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content:
                'Current screen: App drawer\nGoal: Open Android Settings\nNext moves: continue app drawer search',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'I stopped before leaving the app drawer.',
            },
          },
        ],
      });
    const service = new AutomationAiHarnessService(
      {
        getProvider: jest.fn().mockResolvedValue({ provider, model }),
      } as never,
      {
        listAiCommands: jest.fn().mockReturnValue([
          {
            uses: 'android.expandQuickSettings',
            label: 'Expand quick settings',
            description: 'Expand Android quick settings.',
            aiTool: {
              name: 'android_openQuickControlsPanel',
              label: 'Open quick controls panel',
              description: 'Opens status-shade quick controls.',
            },
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
          },
        ]),
      } as never,
      {
        emit: jest.fn(async (event: AutomationRunEventInput) => {
          events.push(event);
          return {
            ...event,
            id: `event_${events.length}`,
            sequence: events.length,
          };
        }),
      } as never,
      {
        observe: jest.fn().mockResolvedValue({
          plannerText: 'Screen observation: app drawer.',
          observation: {
            image: { width: 1080, height: 2340 },
            uiXml: { status: 'available', nodeCount: 4 },
            detections: [],
            summary: 'App drawer with search.',
            screenState: {
              screenKind: 'app_drawer',
              confidence: 0.82,
              visibleText: ['Search apps', 'Settings'],
              controls: [{ label: 'Settings', role: 'app_icon' }],
              evidence: ['App drawer grid visible.'],
              uncertainty: [],
              summary: 'App drawer.',
            },
          },
        }),
      } as never,
      {
        buildForPlanner: jest.fn().mockResolvedValue('Runtime context'),
      } as never,
      { chat } as never,
    );
    const toolExecutor = jest.fn();
    const context: AutomationAiHarnessContext = {
      runId: 'run_1',
      ownerUserId: 'user_1',
      stepId: 'step_1',
      parentStepId: null,
      path: '$',
      app: {} as never,
      adb: {} as never,
      display: {} as never,
      networkPolicy: {} as never,
      toolExecutor,
    };

    await service.run(
      {
        prompt: 'Open Android system Settings',
        maxToolCalls: 1,
        timeoutMs: 30_000,
        allowedTools: ['android.expandQuickSettings'],
        requireFinalAnswer: true,
        providerId: 'provider',
        modelId: 'planner',
      },
      context,
    );

    expect(toolExecutor).not.toHaveBeenCalled();
    expect(
      events.some(
        (event) =>
          event.type === 'ai.guardrail.triggered' &&
          event.data?.uses === 'android.expandQuickSettings' &&
          event.data?.failureCategory === 'no_match',
      ),
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === 'ai.tool.started' &&
          event.data?.uses === 'android.expandQuickSettings',
      ),
    ).toBe(false);
  });
});
