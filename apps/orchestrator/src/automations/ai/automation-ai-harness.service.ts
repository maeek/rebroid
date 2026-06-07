import {
  BadRequestException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common';
import {
  allowedToolMatcher,
  buildChatRequestBody,
  buildInitialMessages,
  buildScreenObservationMessage,
  buildToolDefinitions,
  chatCompletionsEndpoint,
  consumeChatCompletionStream,
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
import {
  SCREEN_MUTATING_TOOLS,
  providerErrorDetailFromText,
  sanitizeAiDataForEvent,
  sanitizeAiDataForModel,
  sanitizeAiText,
} from './automation-ai-observation.utils';
import type { AutomationAiHarnessContext } from './automation-ai.types';
import { AutomationPerceptionService } from '../vision/automation-perception.service';

const textContent = (content: ChatMessage['content']) =>
  typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content
          .filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join('\n')
      : '';

@Injectable()
export class AutomationAiHarnessService {
  private readonly logger = new Logger(AutomationAiHarnessService.name);

  constructor(
    private readonly providers: AutomationAiProviderService,
    private readonly registry: AutomationCommandRegistryService,
    private readonly events: AutomationRunEventBus,
    private readonly perception: AutomationPerceptionService,
  ) {}

  async run(input: AutomationAiRunInput, context: AutomationAiHarnessContext) {
    const { provider, model } = await this.providers.getProvider(
      input.providerId,
      input.modelId,
      'planner',
    );
    const deadline = Date.now() + input.timeoutMs;
    const commands = this.registry.listCommands();
    const allowed = allowedToolMatcher(input.allowedTools);
    const tools = buildToolDefinitions(commands, allowed);
    const usesByToolName = mapUsesByToolName(commands);

    await this.emit(context, 'ai.user.message', input.prompt, {
      clientMessageId: input.clientMessageId ?? null,
    });
    const initialObservation = await this.observeScreen({
      context,
      input,
      deadline,
      reason: 'initial',
    });
    const messages = buildInitialMessages(
      { ...input, initialObservationText: initialObservation.plannerText },
      model,
    );
    let toolCalls = 0;
    let finalText = '';

    await this.emit(context, 'ai.model.started', `Using ${provider.label}`, {
      providerId: provider.id,
      modelId: model.id,
      clientMessageId: input.clientMessageId ?? null,
    });

    while (Date.now() < deadline) {
      this.assertNotCanceled(context.abortSignal);
      const response = await this.chat(
        provider,
        model,
        messages,
        tools,
        deadline,
        context.abortSignal,
        async (delta) => {
          await this.emit(context, 'ai.message.delta', delta, {
            clientMessageId: input.clientMessageId ?? null,
          });
        },
      );
      const choice = response.choices?.[0]?.message;
      if (!choice) {
        throw new BadRequestException('AI provider returned no message.');
      }
      const content = textContent(choice.content);
      if (content.trim()) {
        finalText = content.trim();
        await this.emit(context, 'ai.message.completed', finalText, {
          clientMessageId: input.clientMessageId ?? null,
        });
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
        this.assertNotCanceled(context.abortSignal);
        if (toolCalls >= input.maxToolCalls) {
          await this.emit(
            context,
            'ai.guardrail.triggered',
            'AI tool-call limit reached.',
            {
              maxToolCalls: input.maxToolCalls,
              clientMessageId: input.clientMessageId ?? null,
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
          arguments: sanitizeAiDataForEvent(args),
          clientMessageId: input.clientMessageId ?? null,
        });
        await this.emit(context, 'ai.tool.started', `Calling ${uses}`, {
          uses,
          clientMessageId: input.clientMessageId ?? null,
        });
        try {
          const result = await context.toolExecutor({
            name: uses,
            arguments: args,
          });
          const eventData = sanitizeAiDataForEvent(result.data ?? {});
          const modelData = sanitizeAiDataForModel(result.data ?? {});
          const summary = sanitizeAiText(result.summary);
          await this.emit(context, 'ai.tool.completed', summary, {
            uses,
            output: eventData,
            clientMessageId: input.clientMessageId ?? null,
          });
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({
              summary,
              ...(modelData && typeof modelData === 'object'
                ? (modelData as Record<string, unknown>)
                : { data: modelData }),
            }),
          });

          if (SCREEN_MUTATING_TOOLS.has(uses)) {
            const observation = await this.observeScreen({
              context,
              input,
              deadline,
              reason: 'after-tool',
              uses,
            });
            messages.push(
              buildScreenObservationMessage({
                observation: observation.plannerText,
                summary: `Fresh screenshot captured after ${uses}.`,
              }),
            );
          }
        } catch (error) {
          const message =
            error instanceof Error
              ? sanitizeAiText(error.message)
              : 'Tool call failed.';
          await this.emit(context, 'ai.tool.failed', message, {
            uses,
            clientMessageId: input.clientMessageId ?? null,
          });
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
      { toolCalls, clientMessageId: input.clientMessageId ?? null },
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
    abortSignal?: AbortSignal,
    onContentDelta?: (delta: string) => Promise<void>,
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Math.max(1, deadline - Date.now()),
    );
    const onAbort = () => controller.abort();
    abortSignal?.addEventListener('abort', onAbort, { once: true });
    try {
      let response: Response;
      try {
        response = await fetch(chatCompletionsEndpoint(provider), {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'content-type': 'application/json',
            ...(provider.apiKey
              ? { authorization: `Bearer ${provider.apiKey}` }
              : {}),
          },
          body: JSON.stringify(
            buildChatRequestBody({
              provider,
              model,
              messages,
              tools,
              stream: true,
            }),
          ),
        });
      } catch (error) {
        if (abortSignal?.aborted) {
          throw new BadRequestException('AI automation was canceled.');
        }
        if (Date.now() >= deadline || this.isAbortError(error)) {
          throw new RequestTimeoutException(
            'AI automation timed out waiting for the provider response.',
          );
        }
        throw error;
      }
      if (!response.ok) {
        const detail = await this.readProviderError(response);
        this.logger.warn(
          `AI provider request failed for provider=${provider.id} model=${model.id}: ${response.status} ${response.statusText}`,
        );
        throw new BadRequestException(
          `AI provider request failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`,
        );
      }
      if (!response.body) {
        throw new BadRequestException(
          'AI provider did not return a streaming response body.',
        );
      }
      const result = await this.consumeStream(response.body, onContentDelta);
      return { choices: [{ message: result.message }] };
    } finally {
      abortSignal?.removeEventListener('abort', onAbort);
      clearTimeout(timeout);
    }
  }

  private observeScreen({
    context,
    input,
    deadline,
    reason,
    uses,
  }: {
    context: AutomationAiHarnessContext;
    input: Pick<
      AutomationAiRunInput,
      'clientMessageId' | 'visionProviderId' | 'visionModelId'
    >;
    deadline: number;
    reason: string;
    uses?: string;
  }) {
    return this.perception.observe({
      context: { ...context, clientMessageId: input.clientMessageId ?? null },
      input,
      deadline,
      reason,
      uses,
    });
  }

  private async readProviderError(response: Response) {
    const text = await response.text().catch(() => '');
    return providerErrorDetailFromText(text);
  }

  private async consumeStream(
    body: ReadableStream<Uint8Array>,
    onContentDelta?: (delta: string) => Promise<void>,
  ) {
    let pendingDelta = '';
    let lastFlushAt = Date.now();
    const flush = async (force = false) => {
      if (!pendingDelta) return;
      const shouldFlush =
        force || pendingDelta.length >= 160 || Date.now() - lastFlushAt >= 150;
      if (!shouldFlush) return;
      const delta = pendingDelta;
      pendingDelta = '';
      lastFlushAt = Date.now();
      await onContentDelta?.(sanitizeAiText(delta, 2_000));
    };

    const result = await consumeChatCompletionStream({
      body,
      onUpdate: async ({ contentDelta }) => {
        if (!contentDelta) return;
        pendingDelta += contentDelta;
        await flush(false);
      },
    });
    await flush(true);
    return result;
  }

  private isAbortError(error: unknown) {
    return error instanceof Error && error.name === 'AbortError';
  }

  private assertNotCanceled(abortSignal?: AbortSignal) {
    if (abortSignal?.aborted) {
      throw new BadRequestException('AI automation was canceled.');
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
