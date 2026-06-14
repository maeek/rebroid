import {
  BadRequestException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common';
import {
  allowedToolMatcher,
  buildExecutePlanMessage,
  buildFinalRecoveryMessage,
  buildInitialMessages,
  buildPublicPlanRequestMessage,
  buildReplanMessage,
  buildScreenObservationMessage,
  buildToolDefinitions,
  mapUsesByToolName,
  normalizePublicAiText,
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
import { applyRunVisionDefaults } from './automation-ai-vision-tool-defaults';
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

const observationEventData = (
  observation: Awaited<ReturnType<AutomationPerceptionService['observe']>>,
) => ({
  width: observation.observation.image.width,
  height: observation.observation.image.height,
  uiStatus: observation.observation.uiXml?.status ?? 'unavailable',
  uiNodes: observation.observation.uiXml?.nodeCount ?? null,
  detections: observation.observation.detections.length,
  hasVisionSummary: Boolean(observation.observation.summary),
});

const isVisionLocateMiss = (
  uses: string,
  input: Record<string, unknown>,
  data: Record<string, unknown> | undefined,
) =>
  uses === 'vision.locate' &&
  data?.found === false &&
  typeof input.query === 'string' &&
  input.query.trim().length > 0;

const locateMissKey = (input: Record<string, unknown>) =>
  typeof input.query === 'string' ? input.query.trim().toLowerCase() : '';

@Injectable()
export class AutomationAiHarnessService {
  private readonly logger = new Logger(AutomationAiHarnessService.name);

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
    const locateMisses = new Map<string, number>();

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

    await this.emit(
      context,
      'ai.orientation.completed',
      initialObservation.observation.summary
        ? 'Initial screen orientation completed with vision.'
        : 'Initial screen orientation completed.',
      {
        ...observationEventData(initialObservation),
        clientMessageId: input.clientMessageId ?? null,
      },
    );

    const publicPlanRequest = buildPublicPlanRequestMessage({
      prompt: input.prompt,
    });
    const publicPlan = await this.requestNoToolText({
      provider,
      model,
      messages: [...messages, publicPlanRequest],
      deadline,
      abortSignal: context.abortSignal,
      fallback:
        'Current screen: observed. Goal: complete the requested Android task. Next moves: use the latest observation, navigate or inspect state first, then act. First action: choose the safest available tool. Replan if a tool fails or the screen changes.',
    });
    await this.emit(context, 'ai.plan.proposed', publicPlan, {
      clientMessageId: input.clientMessageId ?? null,
    });
    messages.push(publicPlanRequest, {
      role: 'assistant',
      content: publicPlan,
    });
    messages.push(buildExecutePlanMessage(publicPlan));

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
      const calls = Array.isArray(choice.tool_calls) ? choice.tool_calls : [];
      if (content.trim() && calls.length === 0) {
        finalText = normalizePublicAiText(content);
        await this.emit(context, 'ai.message.completed', finalText, {
          clientMessageId: input.clientMessageId ?? null,
        });
      } else if (content.trim()) {
        await this.emit(
          context,
          'ai.plan.updated',
          normalizePublicAiText(content),
          {
            reason: 'model-progress',
            clientMessageId: input.clientMessageId ?? null,
          },
        );
      }
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
        const parsedToolCall = applyRunVisionDefaults(
          uses,
          parseToolCallArguments(uses, parsedArguments),
          input,
        );
        if (!parsedToolCall.envelopeValid) {
          this.logger.debug(
            `Accepted legacy AI tool-call shape for run=${context.runId ?? 'unknown'} provider=${provider.id} model=${model.id} tool=${uses}`,
          );
        }
        await this.emit(
          context,
          'ai.action.decided',
          parsedToolCall.intent || `Use ${uses}`,
          {
            uses,
            expectedOutcome: parsedToolCall.expectedOutcome,
            clientMessageId: input.clientMessageId ?? null,
          },
        );
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
            isVisionLocateMiss(uses, parsedToolCall.input, result.data ?? {})
          ) {
            const key = locateMissKey(parsedToolCall.input);
            const misses = (locateMisses.get(key) ?? 0) + 1;
            locateMisses.set(key, misses);
            const reason =
              misses >= 2
                ? `Repeated search for "${parsedToolCall.input.query}" found nothing on the current screen. The target is likely not visible here; choose navigation, state discovery, or stop with a clear blocker.`
                : `Search for "${parsedToolCall.input.query}" found nothing on the current screen. Update the plan before trying another route.`;
            await this.replan({
              context,
              input,
              provider,
              model,
              messages,
              deadline,
              reason,
            });
          }

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
            await this.replan({
              context,
              input,
              provider,
              model,
              messages,
              deadline,
              reason: `Screen changed after ${uses}.`,
              observation: observation.plannerText,
            });
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
          await this.replan({
            context,
            input,
            provider,
            model,
            messages,
            deadline,
            reason: `Tool ${uses} failed: ${message}`,
          });
        }
      }
    }

    if (Date.now() >= deadline) {
      throw new RequestTimeoutException('AI automation timed out.');
    }
    if (input.requireFinalAnswer && !finalText) {
      finalText = await this.requestNoToolText({
        provider,
        model,
        messages: [
          ...messages,
          buildFinalRecoveryMessage({ prompt: input.prompt }),
        ],
        deadline,
        abortSignal: context.abortSignal,
        fallback:
          'I could not complete the task. The current screen and tool results did not provide enough confirmed context to finish safely.',
      });
      await this.emit(context, 'ai.message.completed', finalText, {
        clientMessageId: input.clientMessageId ?? null,
        recovered: true,
      });
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

  private async replan({
    context,
    input,
    provider,
    model,
    messages,
    deadline,
    reason,
    observation,
  }: {
    context: AutomationAiHarnessContext;
    input: Pick<AutomationAiRunInput, 'clientMessageId'>;
    provider: Parameters<AutomationAiChatClientService['chat']>[0]['provider'];
    model: Parameters<AutomationAiChatClientService['chat']>[0]['model'];
    messages: ChatMessage[];
    deadline: number;
    reason: string;
    observation?: string;
  }) {
    const request = buildReplanMessage({ reason, observation });
    const plan = await this.requestNoToolText({
      provider,
      model,
      messages: [...messages, request],
      deadline,
      abortSignal: context.abortSignal,
      fallback: `Plan update: ${reason}`,
    });
    await this.emit(context, 'ai.plan.updated', plan, {
      reason,
      clientMessageId: input.clientMessageId ?? null,
    });
    messages.push(request, { role: 'assistant', content: plan });
    messages.push(buildExecutePlanMessage(plan));
  }

  private async requestNoToolText({
    provider,
    model,
    messages,
    deadline,
    abortSignal,
    fallback,
  }: {
    provider: Parameters<AutomationAiChatClientService['chat']>[0]['provider'];
    model: Parameters<AutomationAiChatClientService['chat']>[0]['model'];
    messages: ChatMessage[];
    deadline: number;
    abortSignal?: AbortSignal;
    fallback: string;
  }) {
    const response = await this.chatClient.chat({
      provider,
      model,
      messages,
      tools: [],
      deadline,
      abortSignal,
    });
    const content = textContent(response.choices?.[0]?.message?.content).trim();
    return normalizePublicAiText(sanitizeAiText(content || fallback, 4_000));
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
