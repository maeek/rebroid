import {
  BadRequestException,
  Injectable,
  RequestTimeoutException,
} from '@nestjs/common';
import {
  allowedToolMatcher,
  buildInitialMessages,
  buildScreenObservationMessage,
  buildToolDefinitions,
  mapUsesByToolName,
  parseArguments,
  type ChatMessage,
} from '@rebroid/ai-core/harness';
import type { AutomationAiRunInput } from '@rebroid/ai-core/provider';
import { AutomationCommandRegistryService } from '../commands/automation-command-registry.service';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationAiProviderService } from './automation-ai-provider.service';
import {
  sanitizeAiDataForEvent,
  sanitizeAiDataForToolOutput,
  sanitizeAiDataForModel,
  sanitizeAiText,
} from './automation-ai-observation.utils';
import type { AutomationAiHarnessContext } from './automation-ai.types';
import { AutomationPerceptionService } from '../vision/automation-perception.service';
import {
  blockedToolResult,
  parseToolCallArguments,
  shouldObserveAfterTool,
} from './automation-ai-tool-policy';
import { AutomationAiRuntimeContextService } from './automation-ai-runtime-context.service';
import { AutomationAiChatClientService } from './automation-ai-chat-client.service';

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
  constructor(
    private readonly providers: AutomationAiProviderService,
    private readonly registry: AutomationCommandRegistryService,
    private readonly events: AutomationRunEventBus,
    private readonly perception: AutomationPerceptionService,
    private readonly runtimeContext: AutomationAiRuntimeContextService,
    private readonly chatClient: AutomationAiChatClientService,
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
    const runtimeContext = await this.runtimeContext.buildForPlanner(context);
    const messages = buildInitialMessages(
      {
        ...input,
        initialObservationText: [runtimeContext, initialObservation.plannerText]
          .filter(Boolean)
          .join('\n\n'),
      },
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
      const response = await this.chatClient.chat({
        provider,
        model,
        messages,
        tools,
        deadline,
        abortSignal: context.abortSignal,
        onContentDelta: async (delta) => {
          await this.emit(context, 'ai.message.delta', delta, {
            clientMessageId: input.clientMessageId ?? null,
          });
        },
      });
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
        const parsedArguments = parseArguments(call.function.arguments);
        const parsedToolCall = parseToolCallArguments(uses, parsedArguments);
        if (!parsedToolCall.envelopeValid) {
          await this.emit(
            context,
            'ai.guardrail.triggered',
            'Tool call envelope is not in the expected shape.',
            {
              uses,
              toolCallId: call.id,
              data: sanitizeAiDataForEvent({
                intent: parsedToolCall.intent,
                expectedOutcome: parsedToolCall.expectedOutcome,
                input: parsedToolCall.input,
              }),
              clientMessageId: input.clientMessageId ?? null,
            },
          );
        }
        await this.emit(context, 'ai.tool.arguments', uses, {
          uses,
          intent: parsedToolCall.intent,
          expectedOutcome: parsedToolCall.expectedOutcome,
          envelopeValid: parsedToolCall.envelopeValid,
          requiresScreenObservation:
            parsedToolCall.requiresScreenObservation ?? null,
          arguments: sanitizeAiDataForEvent(parsedToolCall.input),
          clientMessageId: input.clientMessageId ?? null,
        });
        toolCalls += 1;
        const blockedResult = blockedToolResult(uses, parsedToolCall);
        if (blockedResult) {
          await this.emit(context, 'ai.tool.failed', blockedResult.summary, {
            uses,
            clientMessageId: input.clientMessageId ?? null,
          });
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({
              ...blockedResult,
              failed: true,
              recoverable: true,
            }),
          });
          continue;
        }
        await this.emit(context, 'ai.tool.started', `Calling ${uses}`, {
          uses,
          clientMessageId: input.clientMessageId ?? null,
        });
        try {
          const result = await context.toolExecutor({
            name: uses,
            arguments: parsedToolCall.input,
            intent: parsedToolCall.intent,
            expectedOutcome: parsedToolCall.expectedOutcome,
            envelopeValid: parsedToolCall.envelopeValid,
            toolCallId: call.id,
          });
          const eventData = sanitizeAiDataForToolOutput(result.data ?? {});
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

          if (
            shouldObserveAfterTool({
              uses,
              toolCall: parsedToolCall,
            })
          ) {
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
          if (context.abortSignal?.aborted) {
            throw error;
          }
          const message =
            error instanceof Error
              ? sanitizeAiText(error.message)
              : 'Tool call failed.';
          await this.emit(context, 'ai.tool.failed', message, {
            uses,
            clientMessageId: input.clientMessageId ?? null,
          });
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({
              summary: `Tool ${uses} failed: ${message}`,
              error: message,
              failed: true,
              recoverable: true,
            }),
          });
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
    const toolResult = finalText || undefined;
    const completed = !!toolResult || !input.requireFinalAnswer;
    const status = completed ? 'completed' : 'blocked';
    const summary = toolResult || 'AI step completed without a final answer.';

    await this.emit(
      context,
      'ai.model.completed',
      toolResult || 'AI step completed.',
      { toolCalls, clientMessageId: input.clientMessageId ?? null },
    );
    return {
      summary:
        toolResult ||
        `AI step completed after ${toolCalls} tool call${toolCalls === 1 ? '' : 's'}.`,
      data: {
        status,
        completed,
        finalText: toolResult,
        toolCalls,
        blockedReason: completed ? null : 'final answer was not provided',
        evidence: {
          toolCallsUsed: toolCalls,
          maxToolCalls: input.maxToolCalls,
          toolLimitReached: toolCalls >= input.maxToolCalls,
          timedOut: Date.now() >= deadline,
        },
        summary,
      },
    };
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
