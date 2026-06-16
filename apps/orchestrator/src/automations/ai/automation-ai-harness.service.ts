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
  buildReplanMessage,
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
  normalizePublicAiText,
  parseArguments,
  parseToolCallArguments,
  preflightToolCall,
  repeatedToolAttemptGuard,
  shouldObserveAfterTool,
  summarizeObservationCandidates,
  summarizeVisualAffordances,
  toolAttemptKey,
  type ChatMessage,
  type ScreenObservationPolicySnapshot,
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
  isImageInputUnsupportedProviderMessage,
} from './automation-ai-observation.utils';
import type { AutomationAiHarnessContext } from './automation-ai.types';
import { AutomationPerceptionService } from '../vision/automation-perception.service';
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

const observationEventData = (
  observation: Awaited<ReturnType<AutomationPerceptionService['observe']>>,
) => ({
  width: observation.observation.image.width,
  height: observation.observation.image.height,
  uiStatus: observation.observation.uiXml?.status ?? 'unavailable',
  uiNodes: observation.observation.uiXml?.nodeCount ?? null,
  uiDetectionCount:
    observation.observation.uiXml?.detectionCount ??
    observation.observation.detections.length,
  uiRawNodeCount: observation.observation.uiXml?.rawNodeCount ?? null,
  uiDiagnostics: observation.observation.uiXml?.diagnostics ?? null,
  uiError: observation.observation.uiXml?.error ?? null,
  ocrStatus: observation.observation.ocr?.status ?? 'unavailable',
  ocrTextCount: observation.observation.ocr?.detections.length ?? 0,
  ocrDetections: observation.observation.ocr?.detections.slice(0, 20) ?? [],
  detections: observation.observation.detections.length,
  hasVisionSummary: Boolean(observation.observation.summary),
  screenKind: observation.observation.screenState?.screenKind ?? null,
  rawScreenKind: observation.observation.screenState?.rawScreenKind ?? null,
  screenKindCorrectionReason:
    observation.observation.screenState?.correctionReason ?? null,
  settingsAccessVisible:
    observation.observation.screenState?.settingsAccessVisible ?? null,
  visionConfidence: observation.observation.screenState?.confidence ?? null,
  visualControls:
    observation.observation.screenState?.controls.slice(0, 12) ?? [],
  candidates: observation.observation.candidates?.slice(0, 12) ?? [],
  markedScreenshotId: observation.observation.markedScreenshotId ?? null,
  reconciliation: observation.observation.reconciliation ?? null,
  visualAffordances: summarizeVisualAffordances({
    state: observation.observation.screenState ?? null,
  }),
});

const observationSnapshot = (
  observation: Awaited<ReturnType<AutomationPerceptionService['observe']>>,
): ScreenObservationPolicySnapshot => ({
  uiStatus: observation.observation.uiXml?.status ?? 'unavailable',
  uiNodes: observation.observation.uiXml?.nodeCount ?? 0,
  detections: observation.observation.detections.length,
  ocrStatus: observation.observation.ocr?.status ?? 'unavailable',
  ocrText:
    observation.observation.ocr?.detections
      .map((detection) => detection.text ?? detection.label ?? '')
      .filter(Boolean)
      .slice(0, 40) ?? null,
  screenKind: observation.observation.screenState?.screenKind ?? null,
  settingsAccessVisible:
    observation.observation.screenState?.settingsAccessVisible ?? null,
  visibleText: observation.observation.screenState?.visibleText ?? null,
  controls:
    (observation.observation.candidates?.length ?? 0) > 0
      ? observation.observation.candidates.map((candidate) => ({
          label: candidate.label,
          role: candidate.role,
          confidence: candidate.confidence,
        }))
      : (observation.observation.screenState?.controls ?? null),
  visionConfidence: observation.observation.screenState?.confidence ?? null,
  visionSummary: observation.observation.summary ?? null,
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

const confirmedFactFromToolResult = (
  uses: string,
  input: Record<string, unknown>,
  data: Record<string, unknown>,
) => {
  if (uses === 'android.launchPackage') {
    const packageName =
      typeof data.packageName === 'string'
        ? data.packageName
        : typeof input.packageName === 'string'
          ? input.packageName
          : null;
    if (!packageName) return null;
    if (data.launched === true) {
      return `android.launchPackage launched ${packageName}.`;
    }
    if (data.installed === false) {
      return `android.launchPackage confirmed ${packageName} is not installed/launched.`;
    }
    if (data.launched === false) {
      return `android.launchPackage confirmed ${packageName} was not launched.`;
    }
  }
  if (uses === 'android.openSystemSettings') {
    return data.opened === true
      ? 'android.openSystemSettings opened the Android Settings main screen.'
      : 'android.openSystemSettings did not open Android Settings.';
  }
  if (uses === 'android.listPackages') {
    const total = typeof data.total === 'number' ? data.total : null;
    const query =
      typeof data.query === 'string' && data.query.trim()
        ? ` matching "${data.query.trim()}"`
        : '';
    return total === null
      ? 'android.listPackages returned package discovery results.'
      : `android.listPackages found ${total} package(s)${query}.`;
  }
  if (uses === 'android.adbShell') {
    const exitCode = typeof data.exitCode === 'number' ? data.exitCode : null;
    return exitCode === null
      ? 'android.adbShell returned a shell result.'
      : `android.adbShell exited with code ${exitCode}.`;
  }
  return null;
};

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
    const failedAttempts = new Map<string, number>();
    const confirmedFacts: string[] = [];
    let noToolPlanContinuations = 0;
    let sharedMultimodalMode =
      input.visionProviderId === provider.id &&
      input.visionModelId === model.id &&
      model.roles.includes('planner') &&
      model.roles.includes('vision');

    await this.emit(context, 'ai.user.message', input.prompt, {
      clientMessageId: input.clientMessageId ?? null,
    });
    let latestObservation = await this.observeScreen({
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
          this.plannerObservationText(
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

    await this.emit(context, 'ai.model.started', `Using ${provider.label}`, {
      providerId: provider.id,
      modelId: model.id,
      visionProviderId: input.visionProviderId ?? null,
      visionModelId: input.visionModelId ?? null,
      sharedMultimodalMode,
      clientMessageId: input.clientMessageId ?? null,
    });

    await this.emit(
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
      let response: Awaited<ReturnType<AutomationAiChatClientService['chat']>>;
      try {
        response = await this.chatClient.chat({
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
      } catch (error) {
        if (
          sharedMultimodalMode &&
          error instanceof Error &&
          isImageInputUnsupportedProviderMessage(error.message)
        ) {
          sharedMultimodalMode = false;
          messages.splice(
            0,
            messages.length,
            ...stripImagesFromMessages(messages),
          );
          await this.emit(
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
          latestObservation = await this.observeScreen({
            context,
            input,
            deadline,
            reason: 'shared-multimodal-fallback',
            visionContext: {
              goal: input.prompt,
              confirmedFacts,
              latestHypothesis:
                latestObservation.observation.screenState ?? undefined,
            },
          });
          messages.push(
            buildScreenObservationMessage({
              summary:
                'Separate vision observation captured after shared multimodal fallback.',
              observation: this.plannerObservationText(
                latestObservation,
                confirmedFacts,
                input.prompt,
              ),
            }),
          );
          continue;
        }
        if (
          !isMalformedProviderToolCallError(error) ||
          malformedToolCallRecoveries >= MAX_MALFORMED_TOOL_CALL_RECOVERIES
        ) {
          throw error;
        }
        malformedToolCallRecoveries += 1;
        await this.emit(
          context,
          'ai.guardrail.triggered',
          'AI provider rejected malformed tool-call JSON; requesting a corrected tool call.',
          {
            clientMessageId: input.clientMessageId ?? null,
            recoveries: malformedToolCallRecoveries,
          },
        );
        messages.push(buildMalformedToolCallRecoveryMessage());
        continue;
      }
      malformedToolCallRecoveries = 0;
      const choice = response.choices?.[0]?.message;
      if (!choice) {
        throw new BadRequestException('AI provider returned no message.');
      }
      const content = textContent(choice.content);
      const calls = Array.isArray(choice.tool_calls) ? choice.tool_calls : [];
      let noToolPlan: string | null = null;
      const contentDecision = classifyAssistantResponseContent({
        content,
        toolCallCount: calls.length,
        executedToolCalls: toolCalls,
        noToolPlanContinuations,
        maxNoToolPlanContinuations: MAX_NO_TOOL_PLAN_CONTINUATIONS,
      });
      noToolPlanContinuations = contentDecision.nextNoToolPlanContinuations;
      let recoverNoTool = false;
      if (contentDecision.action === 'continue-plan') {
        if (calls.length === 0) {
          noToolPlan = contentDecision.normalizedText;
          await this.emit(context, 'ai.plan.updated', noToolPlan, {
            reason: 'model-replan',
            clientMessageId: input.clientMessageId ?? null,
          });
        } else {
          await this.emit(
            context,
            'ai.plan.updated',
            contentDecision.normalizedText,
            {
              reason: 'model-progress',
              clientMessageId: input.clientMessageId ?? null,
            },
          );
        }
      } else if (contentDecision.action === 'recover-no-tool') {
        recoverNoTool = true;
        await this.emit(
          context,
          'ai.guardrail.triggered',
          'AI claimed progress or blockage before calling any tool; requesting a concrete tool action.',
          {
            clientMessageId: input.clientMessageId ?? null,
          },
        );
        await this.emit(
          context,
          'ai.plan.updated',
          contentDecision.normalizedText,
          {
            reason: 'premature-no-tool-blocker',
            clientMessageId: input.clientMessageId ?? null,
          },
        );
      } else if (contentDecision.action === 'guardrail') {
        await this.emit(
          context,
          'ai.guardrail.triggered',
          'AI repeated planning without choosing a tool.',
          {
            clientMessageId: input.clientMessageId ?? null,
          },
        );
      } else if (contentDecision.action === 'final') {
        const completionGuard = this.unconfirmedSettingsCompletionGuard({
          prompt: input.prompt,
          text: contentDecision.normalizedText,
          confirmedFacts,
          observation: latestObservation,
        });
        if (completionGuard) {
          recoverNoTool = true;
          await this.emit(context, 'ai.guardrail.triggered', completionGuard, {
            clientMessageId: input.clientMessageId ?? null,
          });
        } else {
          finalText = contentDecision.normalizedText;
          await this.emit(context, 'ai.message.completed', finalText, {
            clientMessageId: input.clientMessageId ?? null,
          });
        }
      }
      messages.push({
        role: 'assistant',
        content: content || null,
        tool_calls: calls,
      });
      if (calls.length === 0) {
        if (noToolPlan) {
          messages.push(buildExecutePlanMessage(noToolPlan));
          continue;
        }
        if (recoverNoTool) {
          messages.push(
            buildNoToolActionRecoveryMessage({ prompt: input.prompt }),
          );
          continue;
        }
        break;
      }
      noToolPlanContinuations = 0;

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
        const attemptKey = toolAttemptKey(uses, parsedToolCall.input);
        const repeatedGuard = repeatedToolAttemptGuard({
          attempts: failedAttempts.get(attemptKey) ?? 0,
          threshold: 1,
        });
        if (repeatedGuard) {
          toolCalls += 1;
          await this.emit(
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
          await this.emit(context, 'ai.tool.failed', repeatedGuard.summary, {
            uses,
            failureCategory: repeatedGuard.category,
            recoveryHint: repeatedGuard.recoveryHint,
            clientMessageId: input.clientMessageId ?? null,
          });
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
          continue;
        }
        const preflightGuard = preflightToolCall({
          uses,
          observation: observationSnapshot(latestObservation),
        });
        if (preflightGuard) {
          toolCalls += 1;
          this.recordFailedAttempt(failedAttempts, attemptKey);
          await this.emit(
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
          await this.emit(context, 'ai.tool.failed', preflightGuard.summary, {
            uses,
            failureCategory: preflightGuard.category,
            recoveryHint: preflightGuard.recoveryHint,
            clientMessageId: input.clientMessageId ?? null,
          });
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
          await this.replan({
            context,
            input,
            provider,
            model,
            messages,
            deadline,
            reason: `${preflightGuard.summary} ${preflightGuard.recoveryHint}`,
            observation: this.plannerObservationText(
              latestObservation,
              confirmedFacts,
              input.prompt,
            ),
          });
          continue;
        }
        if (!parsedToolCall.envelopeValid) {
          this.logger.debug(
            `Accepted compatible AI tool-call shape for run=${context.runId ?? 'unknown'} provider=${provider.id} model=${model.id} tool=${uses}`,
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
          this.recordFailedAttempt(failedAttempts, attemptKey);
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
          messages.push(
            buildToolFailureRecoveryMessage({ reason: blockedResult.summary }),
          );
          continue;
        }
        await this.emit(context, 'ai.tool.started', `Calling ${uses}`, {
          uses,
          clientMessageId: input.clientMessageId ?? null,
        });
        try {
          const beforeObservation = latestObservation;
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
            await this.emit(context, 'ai.tool.failed', failure.summary, {
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
            await this.replan({
              context,
              input,
              provider,
              model,
              messages,
              deadline,
              reason: `${failure.summary} ${failure.recoveryHint}`,
              observation: this.plannerObservationText(
                latestObservation,
                confirmedFacts,
                input.prompt,
              ),
            });
            messages.push(
              buildToolFailureRecoveryMessage({
                reason: `${failure.summary} ${failure.recoveryHint}`,
              }),
            );
            continue;
          }
          failedAttempts.delete(attemptKey);
          this.recordConfirmedFact(
            confirmedFacts,
            uses,
            parsedToolCall.input,
            result.data ?? {},
          );
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
            latestObservation = observation;
            const observationText = this.plannerObservationText(
              observation,
              confirmedFacts,
              input.prompt,
            );
            if (
              sharedMultimodalMode &&
              observation.observation.aiImage?.dataUrl
            ) {
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
              await this.emit(
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
            await this.replan({
              context,
              input,
              provider,
              model,
              messages,
              deadline,
              reason: `Fresh observation after ${uses}.`,
              observation: this.plannerObservationText(
                observation,
                confirmedFacts,
                input.prompt,
              ),
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
          this.recordFailedAttempt(failedAttempts, attemptKey);
          const failure = classifyToolFailure({
            uses,
            message,
          });
          await this.emit(context, 'ai.tool.failed', failure.summary, {
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
          await this.replan({
            context,
            input,
            provider,
            model,
            messages,
            deadline,
            reason: `${failure.summary} ${failure.recoveryHint}`,
            observation: this.plannerObservationText(
              latestObservation,
              confirmedFacts,
              input.prompt,
            ),
          });
          messages.push(
            buildToolFailureRecoveryMessage({
              reason: `${failure.summary} ${failure.recoveryHint}`,
            }),
          );
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
        ai: {
          plannerProviderId: provider.id,
          plannerModelId: model.id,
          visionProviderId: input.visionProviderId ?? null,
          visionModelId: input.visionModelId ?? null,
          sharedMultimodalMode,
          latestScreenKind:
            latestObservation.observation.screenState?.screenKind ?? null,
          latestRawScreenKind:
            latestObservation.observation.screenState?.rawScreenKind ?? null,
          latestScreenKindCorrectionReason:
            latestObservation.observation.screenState?.correctionReason ?? null,
          latestVisionConfidence:
            latestObservation.observation.screenState?.confidence ?? null,
          latestSettingsAccessVisible:
            latestObservation.observation.screenState?.settingsAccessVisible ??
            null,
          latestVisualControls:
            latestObservation.observation.screenState?.controls.slice(0, 12) ??
            [],
          latestCandidates: (
            latestObservation.observation.candidates ?? []
          ).slice(0, 12),
          latestReconciliation:
            latestObservation.observation.reconciliation ?? null,
          latestMarkedScreenshotId:
            latestObservation.observation.markedScreenshotId ?? null,
          latestVisualAffordances: summarizeVisualAffordances({
            state: latestObservation.observation.screenState ?? null,
            goal: input.prompt,
          }),
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
    visionContext,
  }: {
    context: AutomationAiHarnessContext;
    input: Pick<
      AutomationAiRunInput,
      'clientMessageId' | 'visionProviderId' | 'visionModelId'
    >;
    deadline: number;
    reason: string;
    uses?: string;
    visionContext?: Parameters<
      AutomationPerceptionService['observe']
    >[0]['visionContext'];
  }) {
    return this.perception.observe({
      context: { ...context, clientMessageId: input.clientMessageId ?? null },
      input,
      deadline,
      reason,
      uses,
      visionContext,
    });
  }

  private plannerObservationText(
    observation: Awaited<ReturnType<AutomationPerceptionService['observe']>>,
    confirmedFacts: string[],
    goal: string,
  ) {
    const visualAffordances = summarizeVisualAffordances({
      state: observation.observation.screenState ?? null,
      goal,
    });
    const candidateSummary = summarizeObservationCandidates({
      candidates: observation.observation.candidates ?? [],
      goal,
      maxCandidates: 12,
    });
    const plannerText = [
      observation.plannerText,
      candidateSummary,
      visualAffordances,
    ]
      .filter(Boolean)
      .join('\n\n');
    const visibleFacts = confirmedFacts.slice(-12);
    if (visibleFacts.length === 0) return plannerText;
    return [
      'Confirmed tool facts:',
      ...visibleFacts.map((fact) => `- ${fact}`),
      '',
      plannerText,
    ].join('\n');
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
