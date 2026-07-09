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
  buildMalformedToolCallRecoveryMessage,
  buildNoToolActionRecoveryMessage,
  buildPublicPlanRequestMessage,
  buildScreenshotObservationMessage,
  buildScreenObservationMessage,
  buildToolFailureRecoveryMessage,
  applyRunVisionDefaults,
  blockedToolResult,
  classifyToolFailure,
  classifyToolOutcome,
  classifyAssistantResponseContent,
  buildToolDefinitions,
  isSettingsOpenClaimConfirmed,
  mapUsesByToolName,
  parseArguments,
  parseToolCallArguments,
  preflightToolCall,
  repeatedToolAttemptGuard,
  shouldObserveAfterTool,
  summarizeVisualAffordances,
  toolAttemptKey,
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
  sanitizeAiDataForEvent,
  sanitizeAiDataForToolOutput,
  sanitizeAiDataForModel,
  sanitizeAiText,
  isImageInputUnsupportedProviderMessage,
} from './automation-ai-observation.utils';
import type { AutomationAiHarnessContext } from './automation-ai.types';
import { AutomationPerceptionService } from '../vision/automation-perception.service';
import { AutomationAiRuntimeContextService } from './automation-ai-runtime-context.service';
import { AutomationAiChatClientService } from './automation-ai-chat-client.service';
import { AutomationAiHarnessRuntimeService } from './automation-ai-harness-runtime.service';
import { textContent } from './automation-ai-message.utils';
import {
  confirmedFactFromToolResult,
  isVisionLocateMiss,
  locateMissKey,
  observationEventData,
  observationSnapshot,
  type HarnessObservation,
} from './automation-ai-harness-observation';

const stripImagesFromMessages = (messages: ChatMessage[]): ChatMessage[] =>
  messages.map((message) => {
    if (!Array.isArray(message.content)) return message;
    const textParts = message.content.filter((part) => part.type === 'text');
    return {
      ...message,
      content:
        textParts.length === 1
          ? textParts[0].text
          : textParts.map((part) => part.text).join('\n'),
    };
  });

const isMalformedProviderToolCallError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('error parsing tool call') ||
    message.includes('unexpected end of json input') ||
    message.includes('malformed tool')
  );
};

const MAX_NO_TOOL_PLAN_CONTINUATIONS = 3;
const MAX_MALFORMED_TOOL_CALL_RECOVERIES = 2;

interface AutomationAiHarnessSession {
  input: AutomationAiRunInput;
  context: AutomationAiHarnessContext;
  provider: AutomationAiProvider;
  model: AutomationAiProviderModel;
  deadline: number;
  tools: ReturnType<typeof buildToolDefinitions>;
  allowed: ReturnType<typeof allowedToolMatcher>;
  usesByToolName: Map<string, string>;
  locateMisses: Map<string, number>;
  failedAttempts: Map<string, number>;
  confirmedFacts: string[];
  noToolPlanContinuations: number;
  sharedMultimodalMode: boolean;
  latestObservation: HarnessObservation;
  messages: ChatMessage[];
  toolCalls: number;
  finalText: string;
  malformedToolCallRecoveries: number;
}

interface AutomationAiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

type AutomationAiToolSession = Pick<
  AutomationAiHarnessSession,
  | 'input'
  | 'context'
  | 'provider'
  | 'model'
  | 'deadline'
  | 'allowed'
  | 'usesByToolName'
  | 'locateMisses'
  | 'failedAttempts'
  | 'confirmedFacts'
  | 'sharedMultimodalMode'
  | 'latestObservation'
  | 'messages'
  | 'toolCalls'
>;

type PreparedAutomationAiToolCall = ReturnType<typeof applyRunVisionDefaults>;

interface PreparedToolCall {
  uses: string;
  parsedToolCall: PreparedAutomationAiToolCall;
  attemptKey: string;
}

interface AutomationAiToolState {
  toolCalls: number;
  latestObservation: HarnessObservation;
}

type AutomationAiToolResult = Awaited<
  ReturnType<AutomationAiHarnessContext['toolExecutor']>
>;

@Injectable()
export class AutomationAiHarnessService {
  private readonly logger = new Logger(AutomationAiHarnessService.name);

  constructor(
    private readonly providers: AutomationAiProviderService,
    private readonly registry: AutomationCommandRegistryService,
    events: AutomationRunEventBus,
    perception: AutomationPerceptionService,
    private readonly runtimeContext: AutomationAiRuntimeContextService,
    private readonly chatClient: AutomationAiChatClientService,
    private readonly harnessRuntime: AutomationAiHarnessRuntimeService = new AutomationAiHarnessRuntimeService(
      events,
      perception,
      chatClient,
    ),
  ) {}

  async run(input: AutomationAiRunInput, context: AutomationAiHarnessContext) {
    const { provider, model } = await this.providers.getProvider(
      input.providerId,
      input.modelId,
      'planner',
    );
    const deadline = Date.now() + input.timeoutMs;
    const commands = this.registry.listAiCommands();
    const allowed = allowedToolMatcher(input.allowedTools);
    const tools = buildToolDefinitions(commands, allowed);
    const usesByToolName = mapUsesByToolName(commands);
    const locateMisses = new Map<string, number>();
    const failedAttempts = new Map<string, number>();
    const confirmedFacts: string[] = [];
    let noToolPlanContinuations = 0;
    let sharedMultimodalMode =
      input.visionProviderId === provider.id &&
      input.visionModelId === model.id &&
      model.roles.includes('planner') &&
      model.roles.includes('vision');

    await this.harnessRuntime.emit(context, 'ai.user.message', input.prompt, {
      clientMessageId: input.clientMessageId ?? null,
    });
    let latestObservation = await this.harnessRuntime.observeScreen({
      context,
      input,
      deadline,
      reason: 'initial',
      visionContext: {
        goal: input.prompt,
      },
    });
    const runtimeContext = await this.runtimeContext.buildForPlanner(context);
    const messages = buildInitialMessages(
      {
        ...input,
        initialObservationText: [
          runtimeContext,
          this.harnessRuntime.plannerObservationText(
            latestObservation,
            confirmedFacts,
            input.prompt,
          ),
        ]
          .filter(Boolean)
          .join('\n\n'),
        ...(sharedMultimodalMode && latestObservation.observation.aiImage
          ? {
              initialScreenshotDataUrl:
                latestObservation.observation.aiImage.dataUrl,
            }
          : {}),
      },
      model,
    );
    let toolCalls = 0;
    let finalText = '';
    let malformedToolCallRecoveries = 0;

    await this.harnessRuntime.emit(
      context,
      'ai.model.started',
      `Using ${provider.label}`,
      {
        providerId: provider.id,
        modelId: model.id,
        visionProviderId: input.visionProviderId ?? null,
        visionModelId: input.visionModelId ?? null,
        sharedMultimodalMode,
        clientMessageId: input.clientMessageId ?? null,
      },
    );

    await this.harnessRuntime.emit(
      context,
      'ai.orientation.completed',
      latestObservation.observation.summary
        ? 'Initial screen orientation completed with vision.'
        : 'Initial screen orientation completed.',
      {
        ...observationEventData(latestObservation),
        clientMessageId: input.clientMessageId ?? null,
      },
    );

    const publicPlanRequest = buildPublicPlanRequestMessage({
      prompt: input.prompt,
    });
    const publicPlan = await this.harnessRuntime.requestNoToolText({
      provider,
      model,
      messages: [...messages, publicPlanRequest],
      deadline,
      abortSignal: context.abortSignal,
      fallback:
        'Current screen: observed. Goal: complete the requested Android task. Next moves: use the latest observation, navigate or inspect state first, then act. First action: choose the safest available tool. Replan if a tool fails or the screen changes.',
    });
    await this.harnessRuntime.emit(context, 'ai.plan.proposed', publicPlan, {
      clientMessageId: input.clientMessageId ?? null,
    });
    messages.push(publicPlanRequest, {
      role: 'assistant',
      content: publicPlan,
    });
    messages.push(buildExecutePlanMessage(publicPlan));

    return this.executeSession({
      input,
      context,
      provider,
      model,
      deadline,
      tools,
      allowed,
      usesByToolName,
      locateMisses,
      failedAttempts,
      confirmedFacts,
      noToolPlanContinuations,
      sharedMultimodalMode,
      latestObservation,
      messages,
      toolCalls,
      finalText,
      malformedToolCallRecoveries,
    });
  }

  private async executeSession(session: AutomationAiHarnessSession) {
    let state = {
      noToolPlanContinuations: session.noToolPlanContinuations,
      sharedMultimodalMode: session.sharedMultimodalMode,
      latestObservation: session.latestObservation,
      toolCalls: session.toolCalls,
      finalText: session.finalText,
      malformedToolCallRecoveries: session.malformedToolCallRecoveries,
    };

    while (Date.now() < session.deadline) {
      this.assertNotCanceled(session.context.abortSignal);
      const requested = await this.requestPlannerResponse(session, state);
      state = { ...state, ...requested.state };
      if (!requested.response) continue;

      const decision = await this.handleAssistantResponse(
        session,
        state,
        requested.response,
      );
      state = { ...state, ...decision.state };
      if (decision.action === 'continue') continue;
      if (decision.action === 'break') break;

      const toolState = await this.executeToolCalls(
        {
          ...session,
          sharedMultimodalMode: state.sharedMultimodalMode,
          latestObservation: state.latestObservation,
          toolCalls: state.toolCalls,
        },
        decision.calls,
      );
      state = { ...state, ...toolState, noToolPlanContinuations: 0 };
    }

    return this.finalizeSession(session, state);
  }

  private async requestPlannerResponse(
    session: AutomationAiHarnessSession,
    state: Pick<
      AutomationAiHarnessSession,
      | 'sharedMultimodalMode'
      | 'latestObservation'
      | 'malformedToolCallRecoveries'
    >,
  ) {
    const { input, context, provider, model, messages, tools, deadline } =
      session;
    try {
      const response = await this.chatClient.chat({
        provider,
        model,
        messages,
        tools,
        deadline,
        abortSignal: context.abortSignal,
        onContentDelta: async (delta) => {
          await this.harnessRuntime.emit(context, 'ai.message.delta', delta, {
            clientMessageId: input.clientMessageId ?? null,
          });
        },
      });
      return {
        response,
        state: { ...state, malformedToolCallRecoveries: 0 },
      };
    } catch (error) {
      if (
        state.sharedMultimodalMode &&
        error instanceof Error &&
        isImageInputUnsupportedProviderMessage(error.message)
      ) {
        return this.fallbackFromSharedMultimodal(session, state);
      }
      if (
        !isMalformedProviderToolCallError(error) ||
        state.malformedToolCallRecoveries >= MAX_MALFORMED_TOOL_CALL_RECOVERIES
      ) {
        throw error;
      }
      const malformedToolCallRecoveries = state.malformedToolCallRecoveries + 1;
      await this.harnessRuntime.emit(
        context,
        'ai.guardrail.triggered',
        'AI provider rejected malformed tool-call JSON; requesting a corrected tool call.',
        {
          clientMessageId: input.clientMessageId ?? null,
          recoveries: malformedToolCallRecoveries,
        },
      );
      messages.push(buildMalformedToolCallRecoveryMessage());
      return {
        response: null,
        state: { ...state, malformedToolCallRecoveries },
      };
    }
  }

  private async fallbackFromSharedMultimodal(
    session: AutomationAiHarnessSession,
    state: Pick<
      AutomationAiHarnessSession,
      'latestObservation' | 'malformedToolCallRecoveries'
    >,
  ) {
    const {
      input,
      context,
      provider,
      model,
      deadline,
      messages,
      confirmedFacts,
    } = session;
    messages.splice(0, messages.length, ...stripImagesFromMessages(messages));
    await this.harnessRuntime.emit(
      context,
      'ai.guardrail.triggered',
      'Selected planner rejected screenshot messages; falling back to separate vision observations.',
      {
        providerId: provider.id,
        modelId: model.id,
        compatibility: 'image-tools-unsupported',
        clientMessageId: input.clientMessageId ?? null,
      },
    );
    const latestObservation = await this.harnessRuntime.observeScreen({
      context,
      input,
      deadline,
      reason: 'shared-multimodal-fallback',
      visionContext: {
        goal: input.prompt,
        confirmedFacts,
        latestHypothesis:
          state.latestObservation.observation.screenState ?? undefined,
      },
    });
    messages.push(
      buildScreenObservationMessage({
        summary:
          'Separate vision observation captured after shared multimodal fallback.',
        observation: this.harnessRuntime.plannerObservationText(
          latestObservation,
          confirmedFacts,
          input.prompt,
        ),
      }),
    );
    return {
      response: null,
      state: {
        ...state,
        sharedMultimodalMode: false,
        latestObservation,
      },
    };
  }

  private async handleAssistantResponse(
    session: AutomationAiHarnessSession,
    state: Pick<
      AutomationAiHarnessSession,
      | 'noToolPlanContinuations'
      | 'latestObservation'
      | 'toolCalls'
      | 'finalText'
    >,
    response: Awaited<ReturnType<AutomationAiChatClientService['chat']>>,
  ): Promise<{
    action: 'continue' | 'break' | 'tools';
    calls: AutomationAiToolCall[];
    state: typeof state;
  }> {
    const { input, messages } = session;
    const choice = response.choices?.[0]?.message;
    if (!choice) {
      throw new BadRequestException('AI provider returned no message.');
    }
    const content = textContent(choice.content);
    const calls = (
      Array.isArray(choice.tool_calls) ? choice.tool_calls : []
    ) as AutomationAiToolCall[];
    const contentDecision = classifyAssistantResponseContent({
      content,
      toolCallCount: calls.length,
      executedToolCalls: state.toolCalls,
      noToolPlanContinuations: state.noToolPlanContinuations,
      maxNoToolPlanContinuations: MAX_NO_TOOL_PLAN_CONTINUATIONS,
    });
    const handled = await this.emitAssistantDecision(
      session,
      state,
      contentDecision,
      calls.length,
    );
    messages.push({
      role: 'assistant',
      content: content || null,
      tool_calls: calls,
    });
    if (calls.length > 0) {
      return {
        action: 'tools',
        calls,
        state: {
          ...state,
          noToolPlanContinuations: 0,
          finalText: handled.finalText,
        },
      };
    }
    if (handled.noToolPlan) {
      messages.push(buildExecutePlanMessage(handled.noToolPlan));
      return {
        action: 'continue',
        calls,
        state: {
          ...state,
          noToolPlanContinuations: contentDecision.nextNoToolPlanContinuations,
          finalText: handled.finalText,
        },
      };
    }
    if (handled.recoverNoTool) {
      messages.push(buildNoToolActionRecoveryMessage({ prompt: input.prompt }));
      return {
        action: 'continue',
        calls,
        state: {
          ...state,
          noToolPlanContinuations: contentDecision.nextNoToolPlanContinuations,
          finalText: handled.finalText,
        },
      };
    }
    return {
      action: 'break',
      calls,
      state: {
        ...state,
        noToolPlanContinuations: contentDecision.nextNoToolPlanContinuations,
        finalText: handled.finalText,
      },
    };
  }

  private async emitAssistantDecision(
    session: AutomationAiHarnessSession,
    state: Pick<AutomationAiHarnessSession, 'latestObservation' | 'finalText'>,
    decision: ReturnType<typeof classifyAssistantResponseContent>,
    toolCallCount: number,
  ) {
    const { input, context, confirmedFacts } = session;
    let noToolPlan: string | null = null;
    let recoverNoTool = false;
    let finalText = state.finalText;

    if (decision.action === 'continue-plan') {
      noToolPlan = toolCallCount === 0 ? decision.normalizedText : null;
      await this.harnessRuntime.emit(
        context,
        'ai.plan.updated',
        decision.normalizedText,
        {
          reason: noToolPlan ? 'model-replan' : 'model-progress',
          clientMessageId: input.clientMessageId ?? null,
        },
      );
    } else if (decision.action === 'recover-no-tool') {
      recoverNoTool = true;
      await this.harnessRuntime.emit(
        context,
        'ai.guardrail.triggered',
        'AI claimed progress or blockage before calling any tool; requesting a concrete tool action.',
        { clientMessageId: input.clientMessageId ?? null },
      );
      await this.harnessRuntime.emit(
        context,
        'ai.plan.updated',
        decision.normalizedText,
        {
          reason: 'premature-no-tool-blocker',
          clientMessageId: input.clientMessageId ?? null,
        },
      );
    } else if (decision.action === 'guardrail') {
      await this.harnessRuntime.emit(
        context,
        'ai.guardrail.triggered',
        'AI repeated planning without choosing a tool.',
        { clientMessageId: input.clientMessageId ?? null },
      );
    } else if (decision.action === 'final') {
      const completionGuard = this.unconfirmedSettingsCompletionGuard({
        prompt: input.prompt,
        text: decision.normalizedText,
        confirmedFacts,
        observation: state.latestObservation,
      });
      recoverNoTool = Boolean(completionGuard);
      if (completionGuard) {
        await this.harnessRuntime.emit(
          context,
          'ai.guardrail.triggered',
          completionGuard,
          { clientMessageId: input.clientMessageId ?? null },
        );
      } else {
        finalText = decision.normalizedText;
        await this.harnessRuntime.emit(
          context,
          'ai.message.completed',
          finalText,
          { clientMessageId: input.clientMessageId ?? null },
        );
      }
    }
    return { noToolPlan, recoverNoTool, finalText };
  }

  private async finalizeSession(
    session: AutomationAiHarnessSession,
    state: Pick<
      AutomationAiHarnessSession,
      'sharedMultimodalMode' | 'latestObservation' | 'toolCalls' | 'finalText'
    >,
  ) {
    if (Date.now() >= session.deadline) {
      throw new RequestTimeoutException('AI automation timed out.');
    }
    const finalText = await this.recoverFinalText(session, state.finalText);
    const toolResult = finalText || undefined;
    await this.harnessRuntime.emit(
      session.context,
      'ai.model.completed',
      toolResult || 'AI step completed.',
      {
        toolCalls: state.toolCalls,
        clientMessageId: session.input.clientMessageId ?? null,
      },
    );
    return this.buildFinalResult(session, state, toolResult);
  }

  private async recoverFinalText(
    session: AutomationAiHarnessSession,
    currentFinalText: string,
  ) {
    const { input, context, provider, model, deadline, messages } = session;
    if (!input.requireFinalAnswer || currentFinalText) return currentFinalText;
    const recovered = await this.harnessRuntime.requestNoToolText({
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
    await this.harnessRuntime.emit(context, 'ai.message.completed', recovered, {
      clientMessageId: input.clientMessageId ?? null,
      recovered: true,
    });
    return recovered;
  }

  private buildFinalResult(
    session: AutomationAiHarnessSession,
    state: Pick<
      AutomationAiHarnessSession,
      'sharedMultimodalMode' | 'latestObservation' | 'toolCalls'
    >,
    toolResult: string | undefined,
  ) {
    const { input, deadline } = session;
    const completed = Boolean(toolResult) || !input.requireFinalAnswer;
    const summary = toolResult || 'AI step completed without a final answer.';
    return {
      summary:
        toolResult ||
        `AI step completed after ${state.toolCalls} tool call${state.toolCalls === 1 ? '' : 's'}.`,
      data: {
        status: completed ? 'completed' : 'blocked',
        completed,
        finalText: toolResult,
        toolCalls: state.toolCalls,
        blockedReason: completed ? null : 'final answer was not provided',
        evidence: {
          toolCallsUsed: state.toolCalls,
          maxToolCalls: input.maxToolCalls,
          toolLimitReached: state.toolCalls >= input.maxToolCalls,
          timedOut: Date.now() >= deadline,
        },
        ai: this.buildFinalAiContext(session, state),
        summary,
      },
    };
  }

  private buildFinalAiContext(
    session: AutomationAiHarnessSession,
    state: Pick<
      AutomationAiHarnessSession,
      'sharedMultimodalMode' | 'latestObservation'
    >,
  ) {
    const { input, provider, model } = session;
    const observation = state.latestObservation.observation;
    const screenState = observation.screenState;
    return {
      plannerProviderId: provider.id,
      plannerModelId: model.id,
      visionProviderId: input.visionProviderId ?? null,
      visionModelId: input.visionModelId ?? null,
      sharedMultimodalMode: state.sharedMultimodalMode,
      latestScreenKind: screenState?.screenKind ?? null,
      latestRawScreenKind: screenState?.rawScreenKind ?? null,
      latestScreenKindCorrectionReason: screenState?.correctionReason ?? null,
      latestVisionConfidence: screenState?.confidence ?? null,
      latestSettingsAccessVisible: screenState?.settingsAccessVisible ?? null,
      latestVisualControls: screenState?.controls.slice(0, 12) ?? [],
      latestCandidates: (observation.candidates ?? []).slice(0, 12),
      latestReconciliation: observation.reconciliation ?? null,
      latestMarkedScreenshotId: observation.markedScreenshotId ?? null,
      latestVisualAffordances: summarizeVisualAffordances({
        state: screenState ?? null,
        goal: input.prompt,
      }),
    };
  }

  private async executeToolCalls(
    session: AutomationAiToolSession,
    calls: AutomationAiToolCall[],
  ) {
    let { toolCalls, latestObservation } = session;
    for (const call of calls) {
      const result = await this.executeToolCall(
        { ...session, toolCalls, latestObservation },
        call,
      );
      toolCalls = result.toolCalls;
      latestObservation = result.latestObservation;
    }
    return { toolCalls, latestObservation };
  }

  private async executeToolCall(
    session: AutomationAiToolSession,
    call: AutomationAiToolCall,
  ) {
    const { input, context, allowed, usesByToolName } = session;
    let { toolCalls, latestObservation } = session;

    this.assertNotCanceled(context.abortSignal);
    if (toolCalls >= input.maxToolCalls) {
      await this.harnessRuntime.emit(
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
    const attemptKey = toolAttemptKey(uses, parsedToolCall.input);
    return this.executePreparedToolCall(
      session,
      call,
      { uses, parsedToolCall, attemptKey },
      { toolCalls, latestObservation },
    );
  }

  private async executePreparedToolCall(
    session: AutomationAiToolSession,
    call: AutomationAiToolCall,
    prepared: PreparedToolCall,
    state: AutomationAiToolState,
  ) {
    const {
      input,
      context,
      provider,
      model,
      deadline,
      failedAttempts,
      confirmedFacts,
      messages,
    } = session;
    const { uses, parsedToolCall, attemptKey } = prepared;
    let { toolCalls, latestObservation } = state;
    const repeatedGuard = repeatedToolAttemptGuard({
      attempts: failedAttempts.get(attemptKey) ?? 0,
      threshold: 1,
    });
    if (repeatedGuard) {
      toolCalls += 1;
      await this.harnessRuntime.emit(
        context,
        'ai.guardrail.triggered',
        repeatedGuard.summary,
        {
          uses,
          failureCategory: repeatedGuard.category,
          recoveryHint: repeatedGuard.recoveryHint,
          clientMessageId: input.clientMessageId ?? null,
        },
      );
      await this.harnessRuntime.emit(
        context,
        'ai.tool.failed',
        repeatedGuard.summary,
        {
          uses,
          failureCategory: repeatedGuard.category,
          recoveryHint: repeatedGuard.recoveryHint,
          clientMessageId: input.clientMessageId ?? null,
        },
      );
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify({
          summary: repeatedGuard.summary,
          error: repeatedGuard.summary,
          failureCategory: repeatedGuard.category,
          recoveryHint: repeatedGuard.recoveryHint,
          failed: true,
          recoverable: true,
        }),
      });
      messages.push(
        buildToolFailureRecoveryMessage({
          reason: `${repeatedGuard.summary} ${repeatedGuard.recoveryHint}`,
        }),
      );
      return { toolCalls, latestObservation };
    }
    const preflightGuard = preflightToolCall({
      uses,
      toolCall: parsedToolCall,
      prompt: input.prompt,
      observation: observationSnapshot(latestObservation),
    });
    if (preflightGuard) {
      toolCalls += 1;
      this.recordFailedAttempt(failedAttempts, attemptKey);
      await this.harnessRuntime.emit(
        context,
        'ai.guardrail.triggered',
        preflightGuard.summary,
        {
          uses,
          failureCategory: preflightGuard.category,
          recoveryHint: preflightGuard.recoveryHint,
          clientMessageId: input.clientMessageId ?? null,
        },
      );
      await this.harnessRuntime.emit(
        context,
        'ai.tool.failed',
        preflightGuard.summary,
        {
          uses,
          failureCategory: preflightGuard.category,
          recoveryHint: preflightGuard.recoveryHint,
          clientMessageId: input.clientMessageId ?? null,
        },
      );
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify({
          summary: preflightGuard.summary,
          error: preflightGuard.summary,
          failureCategory: preflightGuard.category,
          recoveryHint: preflightGuard.recoveryHint,
          failed: true,
          recoverable: true,
        }),
      });
      await this.harnessRuntime.replan({
        context,
        input,
        provider,
        model,
        messages,
        deadline,
        reason: `${preflightGuard.summary} ${preflightGuard.recoveryHint}`,
        observation: this.harnessRuntime.plannerObservationText(
          latestObservation,
          confirmedFacts,
          input.prompt,
        ),
      });
      return { toolCalls, latestObservation };
    }
    return this.executeAcceptedToolCall(session, call, prepared, {
      toolCalls,
      latestObservation,
    });
  }

  private async executeAcceptedToolCall(
    session: AutomationAiToolSession,
    call: AutomationAiToolCall,
    prepared: PreparedToolCall,
    state: AutomationAiToolState,
  ) {
    const { input, context, provider, model, failedAttempts, messages } =
      session;
    const { uses, parsedToolCall, attemptKey } = prepared;
    let { toolCalls, latestObservation } = state;
    if (!parsedToolCall.envelopeValid) {
      this.logger.debug(
        `Accepted compatible AI tool-call shape for run=${context.runId ?? 'unknown'} provider=${provider.id} model=${model.id} tool=${uses}`,
      );
    }
    await this.harnessRuntime.emit(
      context,
      'ai.action.decided',
      parsedToolCall.intent || `Use ${uses}`,
      {
        uses,
        expectedOutcome: parsedToolCall.expectedOutcome,
        clientMessageId: input.clientMessageId ?? null,
      },
    );
    await this.harnessRuntime.emit(context, 'ai.tool.arguments', uses, {
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
      this.recordFailedAttempt(failedAttempts, attemptKey);
      await this.harnessRuntime.emit(
        context,
        'ai.tool.failed',
        blockedResult.summary,
        {
          uses,
          clientMessageId: input.clientMessageId ?? null,
        },
      );
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify({
          ...blockedResult,
          failed: true,
          recoverable: true,
        }),
      });
      messages.push(
        buildToolFailureRecoveryMessage({ reason: blockedResult.summary }),
      );
      return { toolCalls, latestObservation };
    }
    await this.harnessRuntime.emit(
      context,
      'ai.tool.started',
      `Calling ${uses}`,
      {
        uses,
        clientMessageId: input.clientMessageId ?? null,
      },
    );
    return this.invokeAcceptedToolCall(session, call, prepared, {
      toolCalls,
      latestObservation,
    });
  }

  private async invokeAcceptedToolCall(
    session: AutomationAiToolSession,
    call: AutomationAiToolCall,
    prepared: PreparedToolCall,
    state: AutomationAiToolState,
  ) {
    const { context } = session;
    const { uses, parsedToolCall } = prepared;
    try {
      const beforeObservation = state.latestObservation;
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
      const toolFailed = this.resultIndicatesFailure(result.data ?? {});
      if (toolFailed) {
        return this.handleFailedToolResult(
          session,
          call,
          prepared,
          state,
          result,
          summary,
          eventData,
          modelData,
        );
      }
      return this.handleSuccessfulToolResult(
        session,
        call,
        prepared,
        state,
        beforeObservation,
        result,
        summary,
        eventData,
        modelData,
      );
    } catch (error) {
      if (context.abortSignal?.aborted) {
        throw error;
      }
      return this.handleThrownToolFailure(
        session,
        call,
        prepared,
        state,
        error,
      );
    }
  }

  private async handleThrownToolFailure(
    session: AutomationAiToolSession,
    call: AutomationAiToolCall,
    prepared: PreparedToolCall,
    state: AutomationAiToolState,
    error: unknown,
  ) {
    const {
      input,
      context,
      provider,
      model,
      deadline,
      failedAttempts,
      confirmedFacts,
      messages,
    } = session;
    const { uses, attemptKey } = prepared;
    const message =
      error instanceof Error
        ? sanitizeAiText(error.message)
        : 'Tool call failed.';
    this.recordFailedAttempt(failedAttempts, attemptKey);
    const failure = classifyToolFailure({ uses, message });
    await this.harnessRuntime.emit(context, 'ai.tool.failed', failure.summary, {
      uses,
      failureCategory: failure.category,
      recoveryHint: failure.recoveryHint,
      clientMessageId: input.clientMessageId ?? null,
    });
    messages.push({
      role: 'tool',
      tool_call_id: call.id,
      content: JSON.stringify({
        summary: failure.summary,
        error: failure.summary,
        failureCategory: failure.category,
        recoveryHint: failure.recoveryHint,
        failed: true,
        recoverable: true,
      }),
    });
    await this.harnessRuntime.replan({
      context,
      input,
      provider,
      model,
      messages,
      deadline,
      reason: `${failure.summary} ${failure.recoveryHint}`,
      observation: this.harnessRuntime.plannerObservationText(
        state.latestObservation,
        confirmedFacts,
        input.prompt,
      ),
    });
    messages.push(
      buildToolFailureRecoveryMessage({
        reason: `${failure.summary} ${failure.recoveryHint}`,
      }),
    );
    return state;
  }

  private async handleSuccessfulToolResult(
    session: AutomationAiToolSession,
    call: AutomationAiToolCall,
    prepared: PreparedToolCall,
    state: AutomationAiToolState,
    beforeObservation: HarnessObservation,
    result: AutomationAiToolResult,
    summary: string,
    eventData: unknown,
    modelData: unknown,
  ) {
    const {
      input,
      context,
      provider,
      model,
      deadline,
      locateMisses,
      failedAttempts,
      confirmedFacts,
      messages,
    } = session;
    const { uses, parsedToolCall, attemptKey } = prepared;
    failedAttempts.delete(attemptKey);
    this.recordConfirmedFact(
      confirmedFacts,
      uses,
      parsedToolCall.input,
      result.data ?? {},
    );
    await this.harnessRuntime.emit(context, 'ai.tool.completed', summary, {
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
    if (isVisionLocateMiss(uses, parsedToolCall.input, result.data ?? {})) {
      const key = locateMissKey(parsedToolCall.input);
      const misses = (locateMisses.get(key) ?? 0) + 1;
      locateMisses.set(key, misses);
      const reason =
        misses >= 2
          ? `Repeated search for "${parsedToolCall.input.query}" found nothing on the current screen. The target is likely not visible here; choose navigation, state discovery, or stop with a clear blocker.`
          : `Search for "${parsedToolCall.input.query}" found nothing on the current screen. Update the plan before trying another route.`;
      await this.harnessRuntime.replan({
        context,
        input,
        provider,
        model,
        messages,
        deadline,
        reason,
      });
    }
    const latestObservation = shouldObserveAfterTool({
      uses,
      toolCall: parsedToolCall,
    })
      ? await this.observeAfterToolCall(
          { ...session, latestObservation: state.latestObservation },
          prepared,
          beforeObservation,
        )
      : state.latestObservation;
    return { toolCalls: state.toolCalls, latestObservation };
  }

  private async observeAfterToolCall(
    session: AutomationAiToolSession,
    prepared: PreparedToolCall,
    beforeObservation: HarnessObservation,
  ) {
    const {
      input,
      context,
      provider,
      model,
      deadline,
      failedAttempts,
      confirmedFacts,
      sharedMultimodalMode,
      messages,
      latestObservation,
    } = session;
    const { uses, parsedToolCall, attemptKey } = prepared;
    const observation = await this.harnessRuntime.observeScreen({
      context,
      input,
      deadline,
      reason: 'after-tool',
      uses,
      visionContext: {
        goal: input.prompt,
        lastAction: parsedToolCall.intent || `Use ${uses}`,
        expectedOutcome: parsedToolCall.expectedOutcome,
        confirmedFacts,
        latestHypothesis:
          latestObservation.observation.screenState ?? undefined,
      },
    });
    const outcome = classifyToolOutcome({
      uses,
      before: observationSnapshot(beforeObservation),
      after: observationSnapshot(observation),
    });
    const observationText = this.harnessRuntime.plannerObservationText(
      observation,
      confirmedFacts,
      input.prompt,
    );
    if (sharedMultimodalMode && observation.observation.aiImage?.dataUrl) {
      messages.push(
        buildScreenshotObservationMessage({
          dataUrl: observation.observation.aiImage.dataUrl,
          summary: [
            `Fresh observation captured after ${uses}. Verify whether the expected outcome happened before choosing the next action.`,
            '',
            'Current screen observation:',
            observationText,
          ].join('\n'),
        }),
      );
    } else {
      messages.push(
        buildScreenObservationMessage({
          observation: observationText,
          summary: `Fresh observation captured after ${uses}. Verify whether the expected outcome happened before choosing the next action.`,
        }),
      );
    }
    if (outcome.category === 'no_effect') {
      this.recordFailedAttempt(failedAttempts, attemptKey);
      await this.harnessRuntime.emit(
        context,
        'ai.guardrail.triggered',
        outcome.summary ?? 'The action had no observed effect.',
        {
          uses,
          failureCategory: outcome.category,
          recoveryHint: outcome.recoveryHint,
          outcomeBasis: outcome.basis ?? null,
          clientMessageId: input.clientMessageId ?? null,
        },
      );
      messages.push(
        buildToolFailureRecoveryMessage({
          reason: `${outcome.summary} ${outcome.recoveryHint}`,
        }),
      );
    }
    await this.harnessRuntime.replan({
      context,
      input,
      provider,
      model,
      messages,
      deadline,
      reason: `Fresh observation after ${uses}.`,
      observation: this.harnessRuntime.plannerObservationText(
        observation,
        confirmedFacts,
        input.prompt,
      ),
    });
    return observation;
  }

  private async handleFailedToolResult(
    session: AutomationAiToolSession,
    call: AutomationAiToolCall,
    prepared: PreparedToolCall,
    state: AutomationAiToolState,
    result: AutomationAiToolResult,
    summary: string,
    eventData: unknown,
    modelData: unknown,
  ) {
    const {
      input,
      context,
      provider,
      model,
      deadline,
      failedAttempts,
      confirmedFacts,
      messages,
    } = session;
    const { uses, parsedToolCall, attemptKey } = prepared;
    this.recordFailedAttempt(failedAttempts, attemptKey);
    this.recordConfirmedFact(
      confirmedFacts,
      uses,
      parsedToolCall.input,
      result.data ?? {},
    );
    const failure = classifyToolFailure({
      uses,
      message: summary,
      data: result.data ?? {},
    });
    await this.harnessRuntime.emit(context, 'ai.tool.failed', failure.summary, {
      uses,
      failureCategory: failure.category,
      recoveryHint: failure.recoveryHint,
      output: eventData,
      clientMessageId: input.clientMessageId ?? null,
    });
    messages.push({
      role: 'tool',
      tool_call_id: call.id,
      content: JSON.stringify({
        summary: failure.summary,
        error: failure.summary,
        failureCategory: failure.category,
        recoveryHint: failure.recoveryHint,
        failed: true,
        recoverable: true,
        ...(modelData && typeof modelData === 'object'
          ? (modelData as Record<string, unknown>)
          : { data: modelData }),
      }),
    });
    await this.harnessRuntime.replan({
      context,
      input,
      provider,
      model,
      messages,
      deadline,
      reason: `${failure.summary} ${failure.recoveryHint}`,
      observation: this.harnessRuntime.plannerObservationText(
        state.latestObservation,
        confirmedFacts,
        input.prompt,
      ),
    });
    messages.push(
      buildToolFailureRecoveryMessage({
        reason: `${failure.summary} ${failure.recoveryHint}`,
      }),
    );
    return state;
  }

  private resultIndicatesFailure(data: Record<string, unknown>) {
    return (
      data.failed === true ||
      data.opened === false ||
      data.launched === false ||
      (typeof data.exitCode === 'number' && data.exitCode !== 0)
    );
  }

  private unconfirmedSettingsCompletionGuard({
    prompt,
    text,
    confirmedFacts,
    observation,
  }: {
    prompt: string;
    text: string;
    confirmedFacts: string[];
    observation: Awaited<ReturnType<AutomationPerceptionService['observe']>>;
  }) {
    const taskMentionsSettings = /\bsettings?\b/i.test(prompt);
    const textClaimsSettingsOpen =
      /\bsettings?\b/i.test(text) &&
      /\b(open|opened|visible|showing)\b/i.test(text);
    if (!taskMentionsSettings || !textClaimsSettingsOpen) return null;
    const screenState = observation.observation.screenState;
    if (
      isSettingsOpenClaimConfirmed({
        screenKind: screenState?.screenKind ?? null,
        confirmedFacts,
        visibleText: screenState?.visibleText ?? [],
      })
    ) {
      return null;
    }
    return 'AI claimed Settings was open without a confirmed Settings-app screen. Quick settings gear access is only a candidate next action, not task completion.';
  }

  private recordFailedAttempt(map: Map<string, number>, key: string) {
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  private recordConfirmedFact(
    facts: string[],
    uses: string,
    input: Record<string, unknown>,
    data: Record<string, unknown>,
  ) {
    const fact = confirmedFactFromToolResult(uses, input, data);
    if (!fact) return;
    facts.push(fact);
    if (facts.length > 30) facts.splice(0, facts.length - 30);
  }

  private assertNotCanceled(abortSignal?: AbortSignal) {
    if (abortSignal?.aborted) {
      throw new BadRequestException('AI automation was canceled.');
    }
  }
}
