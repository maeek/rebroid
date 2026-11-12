import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
} from '../../settings/contracts/ai-provider';
import { AndroidAutomationCommandsService } from '../commands/android-automation-commands.service';
import { AiAutomationCommandsService } from '../commands/ai-automation-commands.service';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { ContainerNetworkAutomationCommandsService } from '../commands/container-network-automation-commands.service';
import { GenericAutomationCommandsService } from '../commands/generic-automation-commands.service';
import { AutomationConditionService } from '../condition/automation-condition.service';
import { AutomationDefinitionNormalizerService } from '../definition/automation-definition-normalizer.service';
import { AutomationDefinitionService } from '../definition/automation-definition.service';
import { AutomationAiChatClientService } from './automation-ai-chat-client.service';
import { AutomationAiProviderService } from './automation-ai-provider.service';
import type { AutomationYamlDraftStreamEvent } from '@rebroid/automation-core/yaml-draft';
import { AutomationAiYamlDraftService } from './automation-ai-yaml-draft.service';

const provider: AutomationAiProvider = {
  id: 'local',
  label: 'Local',
  kind: 'ollama',
  protocol: 'openai-chat-completions',
  serverFlavor: 'auto',
  baseUrl: 'http://localhost:11434',
  apiKey: null,
  enabled: true,
  models: [],
};

const model: AutomationAiProviderModel = {
  id: 'qwen',
  label: 'Qwen',
  roles: ['planner'],
  settings: {
    systemPrompt: null,
    temperature: 0.2,
    topP: null,
    topK: null,
    numCtx: null,
    repeatPenalty: null,
    seed: null,
    keepAlive: null,
  },
  enabled: true,
  defaultFor: ['planner'],
};

const validYaml = `
apiVersion: rebroid.io/automation/v1
kind: AndroidAutomation
metadata:
  name: Login smoke
  description: Open the app and verify home text.
  tags:
    - name: ai
      color: '#0ea5e9'
spec:
  steps:
    - id: wake-device
      uses: android.viewerCommand
      with:
        command: wake
    - id: wait-home
      uses: android.waitForText
      with:
        text: Home
        timeoutMs: 10000
`;

const controlYaml = `
apiVersion: rebroid.io/automation/v1
kind: AndroidAutomation
metadata:
  name: Retry readiness
spec:
  steps:
    - id: read-clipboard
      uses: android.getClipboard
      with: {}
    - id: branch
      type: condition
      condition:
        groups:
          - conditions:
              - value:
                  source: stepOutput
                  stepId: read-clipboard
                  outputKey: text
                operator: contains
                compare:
                  source: literal
                  value: ready
      then:
        - id: stop-ready
          uses: flow.stop
          with:
            reason: ready
      else:
        - id: retry
          type: repeat
          count: 2
          steps:
            - id: wait
              uses: android.wait
              with:
                durationMs: 500
`;

const createService = (openAi = false) => {
  const registry = new AutomationCommandRegistryService(
    new AndroidAutomationCommandsService(),
    new ContainerNetworkAutomationCommandsService(),
    new GenericAutomationCommandsService(),
    new AiAutomationCommandsService(),
  );
  registry.onModuleInit();
  const definitions = new AutomationDefinitionService(
    new AutomationDefinitionNormalizerService(
      registry,
      new AutomationConditionService(),
    ),
  );
  const providers = {
    getProvider: jest.fn().mockResolvedValue(
      openAi
        ? {
            provider: {
              ...provider,
              id: 'openai',
              kind: 'openai',
              serverFlavor: 'openai',
              baseUrl: 'https://api.openai.com/v1',
            },
            model: { ...model, id: 'gpt-5.6-luna' },
          }
        : { provider, model },
    ),
  } as unknown as AutomationAiProviderService;
  const chatClient = openAi
    ? new AutomationAiChatClientService()
    : ({ chat: jest.fn() } as unknown as AutomationAiChatClientService);
  return {
    chat: jest.mocked(chatClient.chat),
    service: new AutomationAiYamlDraftService(
      providers,
      registry,
      definitions,
      chatClient,
    ),
  };
};

const toolResponse = (yaml: string) => ({
  choices: [
    {
      message: {
        role: 'assistant' as const,
        content: null,
        tool_calls: [
          {
            id: 'call-1',
            type: 'function' as const,
            function: {
              name: 'submitAutomationYaml',
              arguments: JSON.stringify({ yaml }),
            },
          },
        ],
      },
    },
  ],
});

const collectDraftEvents = async (
  service: AutomationAiYamlDraftService,
  input: Parameters<AutomationAiYamlDraftService['draftEvents']>[0],
) => {
  const events: AutomationYamlDraftStreamEvent[] = [];
  for await (const event of service.draftEvents(input)) {
    events.push(event);
  }
  return events;
};

const completedDraft = (
  events: Awaited<ReturnType<typeof collectDraftEvents>>,
) => {
  const event = events.find((item) => item.type === 'draft.completed');
  if (!event || event.type !== 'draft.completed') {
    throw new Error('draft.completed event was not emitted');
  }
  return event.data;
};

describe('AutomationAiYamlDraftService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('drafts with Luna through Responses and replays reasoning on YAML repair', async () => {
    const reasoning = {
      type: 'reasoning',
      id: 'rs_1',
      summary: [],
      encrypted_content: 'encrypted-test-reasoning',
    };
    const submission = (id: number, yaml: string) => ({
      type: 'function_call',
      id: `fc_${id}`,
      call_id: `call_${id}`,
      name: 'submitAutomationYaml',
      arguments: JSON.stringify({ yaml }),
      status: 'completed',
    });
    const invalidSubmission = submission(1, 'apiVersion: bad');
    const response = (output: unknown[]) =>
      new Response(
        `data: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed', output } })}\n\n`,
        { headers: { 'content-type': 'text/event-stream' } },
      );
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (url) => {
        if (url === 'https://api.openai.com/v1/chat/completions') {
          return new Response(
            JSON.stringify({
              error: {
                message:
                  'Function tools with reasoning_effort are not supported for gpt-5.6-luna in /v1/chat/completions.',
              },
            }),
            { status: 400, statusText: 'Bad Request' },
          );
        }
        return fetchMock.mock.calls.length === 1
          ? response([reasoning, invalidSubmission])
          : response([submission(2, validYaml)]);
      });

    const { service } = createService(true);
    const events = await collectDraftEvents(service, {
      prompt: 'Draft a smoke test.',
      providerId: 'openai',
      modelId: 'gpt-5.6-luna',
    });

    expect(events.at(-1)).toMatchObject({ type: 'draft.completed' });
    expect(completedDraft(events).yaml).toContain('uses: android.waitForText');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [first, second] = fetchMock.mock.calls;
    expect(first[0]).toBe('https://api.openai.com/v1/responses');
    expect(second[0]).toBe(first[0]);
    const firstBody = JSON.parse(String(first[1]?.body)) as Record<
      string,
      unknown
    >;
    const secondBody = JSON.parse(String(second[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(firstBody).toMatchObject({
      model: 'gpt-5.6-luna',
      store: false,
      stream: true,
      include: ['reasoning.encrypted_content'],
      parallel_tool_calls: false,
      tools: [
        { type: 'function', name: 'submitAutomationYaml' },
        { type: 'function', name: 'requestDraftClarification' },
      ],
    });
    expect(firstBody).not.toHaveProperty('temperature');
    expect(firstBody).not.toHaveProperty('reasoning_format');
    expect(secondBody.input).toEqual([
      ...(firstBody.input as unknown[]),
      reasoning,
      invalidSubmission,
      {
        type: 'function_call_output',
        call_id: 'call_1',
        output: expect.stringContaining(
          'apiVersion must be rebroid.io/automation/v1',
        ),
      },
    ]);
  });

  it('reports streamed progress and fails when OpenAI does not complete the response', async () => {
    const delta =
      'Preparing the requested workflow with a device wake step and an explicit wait for the home screen, using the commands and timeout limits available in this workspace.';
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          `data: ${JSON.stringify({ type: 'response.output_text.delta', delta })}\n\n`,
          { headers: { 'content-type': 'text/event-stream' } },
        ),
      );
    const { service } = createService(true);

    const events = await collectDraftEvents(service, { prompt: 'Draft this.' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'draft.message.delta', message: delta }),
    );
    expect(events.at(-1)).toMatchObject({
      type: 'draft.failed',
      message: 'OpenAI ended the stream before completing the response.',
    });
  });

  it('generates normalized YAML from a submitted multi-step draft', async () => {
    const { chat, service } = createService();
    chat.mockResolvedValue(toolResponse(validYaml));

    const events = await collectDraftEvents(service, {
      prompt: 'Open the app and verify the home screen.',
      providerId: 'local',
      modelId: 'qwen',
    });
    const draft = completedDraft(events);

    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        'draft.started',
        'draft.model.started',
        'draft.phase',
        'draft.completed',
      ]),
    );
    expect(draft.definition.spec.steps).toHaveLength(2);
    expect(draft.definition.spec.steps[0]).toMatchObject({
      id: 'wake-device',
      uses: 'android.viewerCommand',
    });
    expect(draft.yaml).toContain('uses: android.waitForText');
    const request = chat.mock.calls[0][0];
    expect(JSON.stringify(request.tools)).toContain('submitAutomationYaml');
    expect(JSON.stringify(request.messages)).toContain('android.waitForText');
    expect(JSON.stringify(request.messages)).not.toContain('"uses":"ai.run"');
  });

  it('accepts control steps and previous step output references', async () => {
    const { chat, service } = createService();
    chat.mockResolvedValue(toolResponse(controlYaml));

    const draft = completedDraft(
      await collectDraftEvents(service, {
        prompt: 'Branch on readiness and retry.',
      }),
    );

    expect(draft.definition.spec.steps[1]).toMatchObject({
      id: 'branch',
      type: 'condition',
    });
    expect(draft.yaml).toContain('type: repeat');
  });

  it('repairs invalid model YAML before returning a draft', async () => {
    const { chat, service } = createService();
    chat
      .mockResolvedValueOnce(toolResponse('apiVersion: bad'))
      .mockResolvedValueOnce(toolResponse(validYaml));

    const events = await collectDraftEvents(service, {
      prompt: 'Draft a smoke test.',
    });
    const draft = completedDraft(events);

    expect(draft.definition.metadata.name).toBe('Login smoke');
    expect(events.map((event) => event.type)).toContain(
      'draft.validation.failed',
    );
    expect(events.map((event) => event.type)).toContain('draft.repair.started');
    expect(chat).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(chat.mock.calls[1][0].messages)).toContain(
      'apiVersion must be rebroid.io/automation/v1',
    );
  });

  it('filters draft commands by allowed tool permissions', async () => {
    const { chat, service } = createService();
    chat.mockResolvedValue(toolResponse(validYaml));

    const events = await collectDraftEvents(service, {
      prompt: 'Draft with restricted tools.',
      allowedTools: ['android.wait'],
    });
    const failed = events.find((event) => event.type === 'draft.failed');
    expect(failed?.message).toContain(
      'Draft uses unavailable automation command',
    );
    const promptMessage = chat.mock.calls[0][0].messages[1].content;
    expect(promptMessage).toContain('"uses":"android.wait"');
    expect(promptMessage).not.toContain('"uses":"android.viewerCommand"');
  });

  it('fails after repeated invalid responses', async () => {
    const { chat, service } = createService();
    chat.mockResolvedValue({
      choices: [{ message: { role: 'assistant', content: 'not yaml' } }],
    });

    const events = await collectDraftEvents(service, { prompt: 'Draft this.' });

    const failed = events.find((event) => event.type === 'draft.failed');
    expect(failed?.message).toContain(
      'AI draft did not produce valid automation YAML',
    );
    expect(chat).toHaveBeenCalledTimes(3);
  });

  it('emits clarification requests from the model', async () => {
    const { chat, service } = createService();
    chat.mockResolvedValue({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call-1',
                type: 'function',
                function: {
                  name: 'requestDraftClarification',
                  arguments: JSON.stringify({
                    question: 'Which package should this workflow launch?',
                  }),
                },
              },
            ],
          },
        },
      ],
    });

    const events = await collectDraftEvents(service, {
      prompt: 'Open the app.',
    });

    const clarification = events.find(
      (event) => event.type === 'draft.clarification.requested',
    );
    expect(clarification?.message).toBe(
      'Which package should this workflow launch?',
    );
  });
});
