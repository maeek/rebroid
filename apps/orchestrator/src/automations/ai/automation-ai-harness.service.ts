import {
  BadRequestException,
  Injectable,
  RequestTimeoutException,
} from '@nestjs/common';
import {
  allowedToolMatcher,
  buildChatRequestBody,
  buildInitialMessages,
  buildToolDefinitions,
  chatCompletionsEndpoint,
  mapUsesByToolName,
  parseArguments,
  type ChatMessage,
} from '@rebroid/ai-core/harness';
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
  AutomationAiRunInput,
} from '@rebroid/ai-core/provider';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationAiProviderService } from './automation-ai-provider.service';
import type { AutomationAiHarnessContext } from './automation-ai.types';

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
    const commands = this.registry.listCommands();
    const allowed = allowedToolMatcher(input.allowedTools);
    const tools = buildToolDefinitions(commands, allowed);
    const usesByToolName = mapUsesByToolName(commands);

    const messages = buildInitialMessages(input, model);
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
      const response = await fetch(chatCompletionsEndpoint(provider), {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          ...(provider.apiKey
            ? { authorization: `Bearer ${provider.apiKey}` }
            : {}),
        },
        body: JSON.stringify(
          buildChatRequestBody({ provider, model, messages, tools }),
        ),
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
