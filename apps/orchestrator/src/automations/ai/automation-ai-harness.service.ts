import {
  BadRequestException,
  Injectable,
  RequestTimeoutException,
} from '@nestjs/common';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationAiProviderService } from './automation-ai-provider.service';
import type {
  AutomationAiHarnessContext,
  AutomationAiProvider,
  AutomationAiProviderModel,
  AutomationAiRunInput,
} from './automation-ai.types';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

@Injectable()
export class AutomationAiHarnessService {
  constructor(
    private readonly providers: AutomationAiProviderService,
    private readonly registry: AutomationCommandRegistryService,
    private readonly events: AutomationRunEventBus,
  ) {}

  async run(input: AutomationAiRunInput, context: AutomationAiHarnessContext) {
    const { provider, model } = await this.providers.getProvider(
      input.providerId,
      input.modelId,
    );
    const deadline = Date.now() + input.timeoutMs;
    const allowed = this.allowedTools(input.allowedTools);
    const tools = this.registry
      .listCommands()
      .filter((command) => command.uses !== 'ai.run' && allowed(command.uses))
      .map((command) => ({
        type: 'function' as const,
        function: {
          name: toolName(command.uses),
          description: `${command.label}. ${command.description}`,
          parameters: command.inputSchema,
        },
      }));
    const usesByToolName = new Map(
      this.registry
        .listCommands()
        .map((command) => [toolName(command.uses), command.uses]),
    );

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: [
          'You are controlling an Android automation through typed tools. Use tools only when needed, keep progress concise, and finish with a short visible summary. Never invent tool results.',
          model.settings.systemPrompt,
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
      { role: 'user', content: input.prompt },
    ];
    let toolCalls = 0;
    let finalText = '';

    await this.emit(context, 'ai.model.started', `Using ${provider.label}`, {
      providerId: provider.id,
      modelId: model.id,
    });

    while (Date.now() < deadline) {
      const response = await this.chat(
        provider,
        model,
        messages,
        tools,
        deadline,
      );
      const choice = response.choices?.[0]?.message;
      if (!choice) {
        throw new BadRequestException('AI provider returned no message.');
      }
      const content = typeof choice.content === 'string' ? choice.content : '';
      if (content.trim()) {
        finalText = content.trim();
        await this.emit(context, 'ai.message.completed', finalText);
      }
      const calls = Array.isArray(choice.tool_calls) ? choice.tool_calls : [];
      messages.push({
        role: 'assistant',
        content: content || null,
        tool_calls: calls,
      });
      if (calls.length === 0) {
        break;
      }

      for (const call of calls) {
        if (toolCalls >= input.maxToolCalls) {
          await this.emit(
            context,
            'ai.guardrail.triggered',
            'AI tool-call limit reached.',
            {
              maxToolCalls: input.maxToolCalls,
            },
          );
          throw new RequestTimeoutException(
            'AI automation reached its tool-call limit.',
          );
        }
        const uses = usesByToolName.get(call.function.name);
        if (!uses || !allowed(uses)) {
          throw new BadRequestException(
            `AI requested unsupported tool "${call.function.name}".`,
          );
        }
        const args = parseArguments(call.function.arguments);
        toolCalls += 1;
        await this.emit(context, 'ai.tool.arguments', uses, {
          uses,
          arguments: args,
        });
        await this.emit(context, 'ai.tool.started', `Calling ${uses}`, {
          uses,
        });
        try {
          const result = await context.toolExecutor({
            name: uses,
            arguments: args,
          });
          await this.emit(context, 'ai.tool.completed', result.summary, {
            uses,
            output: result.data ?? {},
          });
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({
              summary: result.summary,
              ...(result.data ?? {}),
            }),
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Tool call failed.';
          await this.emit(context, 'ai.tool.failed', message, { uses });
          throw error;
        }
      }
    }

    if (Date.now() >= deadline) {
      throw new RequestTimeoutException('AI automation timed out.');
    }
    if (input.requireFinalAnswer && !finalText) {
      throw new BadRequestException(
        'AI automation finished without a final answer.',
      );
    }

    await this.emit(
      context,
      'ai.model.completed',
      finalText || 'AI step completed.',
      { toolCalls },
    );
    return {
      summary:
        finalText ||
        `AI step completed after ${toolCalls} tool call${toolCalls === 1 ? '' : 's'}.`,
      data: { finalText, toolCalls },
    };
  }

  private allowedTools(allowedTools?: string[]) {
    const allowed = new Set((allowedTools ?? []).filter(Boolean));
    return (uses: string) => allowed.size === 0 || allowed.has(uses);
  }

  private async chat(
    provider: AutomationAiProvider,
    model: AutomationAiProviderModel,
    messages: ChatMessage[],
    tools: unknown[],
    deadline: number,
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Math.max(1, deadline - Date.now()),
    );
    try {
      const endpoint =
        provider.kind === 'ollama'
          ? `${provider.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`
          : `${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`;
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          ...(provider.apiKey
            ? { authorization: `Bearer ${provider.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          model: model.id,
          messages,
          tools,
          tool_choice: 'auto',
          temperature: model.settings.temperature ?? 0.2,
          ...(model.settings.topP !== null && model.settings.topP !== undefined
            ? { top_p: model.settings.topP }
            : {}),
          ...(provider.kind === 'ollama'
            ? {
                options: ollamaOptions(model),
                ...(model.settings.keepAlive ? { keep_alive: model.settings.keepAlive } : {}),
              }
            : {}),
        }),
      });
      if (!response.ok) {
        throw new BadRequestException(
          `AI provider request failed: ${response.status} ${response.statusText}`,
        );
      }
      return (await response.json()) as {
        choices?: Array<{ message?: ChatMessage }>;
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private emit(
    context: AutomationAiHarnessContext,
    type: Parameters<AutomationRunEventBus['emit']>[0]['type'],
    message: string,
    data: Record<string, unknown> = {},
  ) {
    return this.events.emit({
      runId: context.runId,
      ownerUserId: context.ownerUserId,
      type,
      stepId: context.stepId,
      parentStepId: context.parentStepId ?? null,
      message,
      data,
    });
  }
}

const toolName = (uses: string) => uses.replace(/[^a-zA-Z0-9_]/g, '__');

const parseArguments = (value: string) => {
  try {
    const parsed = JSON.parse(value || '{}') as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

const ollamaOptions = (model: AutomationAiProviderModel) =>
  Object.fromEntries(
    [
      ['num_ctx', model.settings.numCtx],
      ['repeat_penalty', model.settings.repeatPenalty],
      ['seed', model.settings.seed],
      ['top_k', model.settings.topK],
    ].filter(([, value]) => value !== null && value !== undefined),
  );
