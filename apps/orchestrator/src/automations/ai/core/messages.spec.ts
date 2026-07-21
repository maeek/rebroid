import { strict as assert } from 'node:assert';
import {
  buildChatRequestBody,
  chatCompletionsEndpoint,
} from '../../../common/ai-provider-request';
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
} from '../../../settings/contracts/ai-provider';
import {
  buildExecutePlanMessage,
  buildFinalRecoveryMessage,
  buildInitialMessages,
  buildMalformedToolCallRecoveryMessage,
  buildNoToolActionRecoveryMessage,
  buildPublicPlanRequestMessage,
  buildReplanMessage,
  buildUiXmlObservationMessage,
} from './messages';

const provider: AutomationAiProvider = {
  id: 'local',
  label: 'Local',
  kind: 'ollama',
  protocol: 'openai-chat-completions',
  serverFlavor: 'auto',
  baseUrl: 'http://localhost:11434/',
  apiKey: null,
  enabled: true,
  models: [],
};

const model: AutomationAiProviderModel = {
  id: 'qwen',
  label: 'Qwen',
  roles: ['planner'],
  settings: {
    systemPrompt: 'Use terse summaries.',
    temperature: 0.5,
    topP: 0.9,
    numCtx: 4096,
    topK: 20,
    repeatPenalty: null,
    seed: null,
    keepAlive: '5m',
  },
  enabled: true,
  defaultFor: ['planner'],
};

describe('automation AI messages', () => {
  it('builds chat messages and provider request bodies', () => {
    const initialMessages = buildInitialMessages({ prompt: 'Do it' }, model);
    assert.equal(
      chatCompletionsEndpoint(provider),
      'http://localhost:11434/v1/chat/completions',
    );
    assert.equal(initialMessages.length, 2);
    assert.equal(initialMessages[0].role, 'system');
    assert.ok(
      typeof initialMessages[0].content === 'string' &&
        initialMessages[0].content.includes(
          'When calling tools, use this exact JSON shape',
        ),
    );
    assert.ok(
      typeof initialMessages[0].content === 'string' &&
        initialMessages[0].content.includes(
          'Do not identify unlabeled launcher icons as Settings',
        ),
    );
    assert.ok(
      typeof initialMessages[0].content === 'string' &&
        initialMessages[0].content.includes('android.expandQuickSettings'),
    );
    assert.ok(
      typeof initialMessages[0].content === 'string' &&
        initialMessages[0].content.includes(
          'open the app drawer by swiping up from the bottom edge',
        ),
    );
    assert.deepEqual(initialMessages[1], { role: 'user', content: 'Do it' });
    assert.deepEqual(
      buildInitialMessages(
        {
          prompt: 'Do it',
          initialScreenshotDataUrl: 'data:image/png;base64,abc',
          initialObservationText: 'Screen observation',
        },
        model,
      )[1],
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Do it\n\nCurrent screen observation:\nScreen observation\n\nCurrent screenshot is attached. Inspect both before taking any action.',
          },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,abc' },
          },
        ],
      },
    );
    assert.deepEqual(
      buildInitialMessages(
        {
          prompt: 'Do it',
          initialScreenshotDataUrl: 'data:image/png;base64,abc',
        },
        model,
      )[1],
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Do it\n\nCurrent screenshot is attached. Inspect it before taking any action.',
          },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,abc' },
          },
        ],
      },
    );
    assert.deepEqual(
      buildInitialMessages(
        { prompt: 'Do it', initialObservationText: 'Screen observation' },
        model,
      )[1],
      {
        role: 'user',
        content:
          'Do it\n\nCurrent screen observation:\nScreen observation\n\nInspect this observation before taking any action.',
      },
    );
    assert.deepEqual(
      buildChatRequestBody({
        provider,
        model,
        messages: [],
        tools: [],
      }),
      {
        model: 'qwen',
        messages: [],
        stream: false,
        temperature: 0.5,
        top_p: 0.9,
      },
    );
    const structuredBody = buildChatRequestBody({
      provider,
      model,
      messages: [],
      responseFormat: {
        type: 'json_schema',
        schema: { type: 'object' },
        json_schema: {
          name: 'decision',
          strict: true,
          schema: { type: 'object' },
        },
      },
    });
    assert.deepEqual(
      'response_format' in structuredBody
        ? structuredBody.response_format
        : null,
      {
        type: 'json_schema',
        json_schema: {
          name: 'decision',
          strict: true,
          schema: { type: 'object' },
        },
      },
    );
  });

  it('builds text-only UI XML observations', () => {
    assert.deepEqual(
      buildInitialMessages(
        { prompt: 'Do it', initialUiXml: '<hierarchy />' },
        model,
      )[1],
      {
        role: 'user',
        content:
          'Do it\n\nCurrent UI hierarchy XML:\n<hierarchy />\n\nInspect this UI hierarchy before taking any action.',
      },
    );
    assert.deepEqual(
      buildUiXmlObservationMessage({
        summary: 'Fresh UI hierarchy captured.',
        xml: '<node />',
      }),
      {
        role: 'user',
        content:
          'Fresh UI hierarchy captured.\n\nCurrent UI hierarchy XML:\n<node />\n\nInspect this latest UI hierarchy before deciding the next step.',
      },
    );
  });

  it('builds public planning and recovery messages', () => {
    const planRequest = buildPublicPlanRequestMessage({
      prompt: 'Turn on dark mode',
    });

    assert.equal(planRequest.role, 'user');
    const planContent =
      typeof planRequest.content === 'string' ? planRequest.content : '';
    assert.ok(planContent);
    assert.ok(planContent.includes('Task: Turn on dark mode'));
    assert.ok(planContent.includes('Current screen'));
    assert.ok(planContent.includes('public execution plan'));
    assert.ok(planContent.includes('Markdown text only'));
    assert.ok(planContent.includes('Do not label generic Android robot'));
    assert.ok(planContent.includes('Use quick controls only'));
    assert.ok(planContent.includes('launcher app-drawer route'));
    assert.ok(!planContent.includes('hidden reasoning'));

    const executeMessage = buildExecutePlanMessage(
      '1. Open Settings.\n2. Find Display.\n3. Toggle dark mode.',
    );
    assert.equal(executeMessage.role, 'user');
    const executeContent =
      typeof executeMessage.content === 'string' ? executeMessage.content : '';
    assert.ok(executeContent.includes('Execute the public plan'));

    const replanMessage = buildReplanMessage({
      reason: 'vision.locate did not find dark mode toggle.',
      observation:
        'Screen captured: 0 UI hierarchy element(s) detected. Vision summary received.',
    });
    assert.equal(replanMessage.role, 'user');
    const replanContent =
      typeof replanMessage.content === 'string' ? replanMessage.content : '';
    assert.ok(replanContent.includes('Reason:'));
    assert.ok(replanContent.includes('Latest observation:'));
    assert.ok(replanContent.includes('Do not retry guessed coordinate taps'));
    assert.ok(replanContent.includes('android.expandNotifications'));
    assert.ok(replanContent.includes('swipe up from the bottom to show apps'));

    const recoveryMessage = buildFinalRecoveryMessage({
      prompt: 'Turn on dark mode',
    });
    assert.equal(recoveryMessage.role, 'user');
    const recoveryContent =
      typeof recoveryMessage.content === 'string'
        ? recoveryMessage.content
        : '';
    assert.ok(recoveryContent.includes('final answer'));

    const noToolRecoveryMessage = buildNoToolActionRecoveryMessage({
      prompt: 'Turn on dark mode',
    });
    const noToolRecoveryContent =
      typeof noToolRecoveryMessage.content === 'string'
        ? noToolRecoveryMessage.content
        : '';
    assert.ok(noToolRecoveryContent.includes('no tool has been called'));
    assert.ok(noToolRecoveryContent.includes('android.openSystemSettings'));
    assert.ok(noToolRecoveryContent.includes('go through the app drawer'));

    const malformedToolCallRecovery = buildMalformedToolCallRecoveryMessage();
    const malformedToolCallRecoveryContent =
      typeof malformedToolCallRecovery.content === 'string'
        ? malformedToolCallRecovery.content
        : '';
    assert.ok(
      malformedToolCallRecoveryContent.includes(
        'malformed JSON. No tool was executed',
      ),
    );
    assert.ok(
      malformedToolCallRecoveryContent.includes(
        '"intent":"short action","expectedOutcome":"verifiable result","input":{...}',
      ),
    );
  });
});
