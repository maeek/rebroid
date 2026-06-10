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
  type AutomationToolEnvelopeResult,
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
  isDangerousAdbShellCommand,
  providerErrorDetailFromText,
  sanitizeAiDataForEvent,
  sanitizeAiDataForToolOutput,
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
    const runtimeContext = await this.runtimeContextForPlanner(context);
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
        const parsedArguments = parseArguments(call.function.arguments);
        const parsedToolCall = this.parseToolCallArguments(
          uses,
          parsedArguments,
        );
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
        const blockedToolResult = this.blockedToolResult(uses, parsedToolCall);
        if (blockedToolResult) {
          await this.emit(
            context,
            'ai.tool.failed',
            blockedToolResult.summary,
            {
              uses,
              clientMessageId: input.clientMessageId ?? null,
            },
          );
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({
              ...blockedToolResult,
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
            await this.shouldObserveAfterTool({
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

  private async shouldObserveAfterTool({
    uses,
    toolCall,
  }: {
    uses: string;
    toolCall: AutomationToolEnvelopeResult;
  }): Promise<boolean> {
    if (!SCREEN_MUTATING_TOOLS.has(uses)) {
      return false;
    }

    if (uses !== 'android.adbShell') {
      return true;
    }

    const command =
      typeof toolCall.input.command === 'string' ? toolCall.input.command : '';
    if (!command.trim()) {
      return true;
    }
    if (toolCall.requiresScreenObservation === false) {
      return false;
    }
    return true;
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

  private async runtimeContextForPlanner(context: AutomationAiHarnessContext) {
    const packageContext = await this.installedPackageContext(context);
    return [
      'Runtime context:',
      `- Rebroid app name: ${sanitizeAiText(context.app.name, 200)}`,
      context.app.apkPackageName
        ? `- Recorded uploaded APK package: ${context.app.apkPackageName}`
        : '- Recorded uploaded APK package: none',
      packageContext,
      '- Before launching an app by package, use the recorded package or a package listed here. If the needed package is missing, ask the user for it instead of guessing or installing it.',
      '- If more package detail is needed, call android.listPackages with a narrow query.',
    ].join('\n');
  }

  private async installedPackageContext(context: AutomationAiHarnessContext) {
    try {
      let result = await context.adb.shell(
        context.app,
        'pm list packages -3',
        5_000,
      );
      if (result.exitCode !== 0) {
        result = await context.adb.shell(
          context.app,
          'cmd package list packages -3',
          5_000,
        );
      }
      if (result.exitCode !== 0) {
        return `- Installed third-party packages: unavailable (${sanitizeAiText(result.stderr || result.stdout, 300)}).`;
      }
      const packages = result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .map((line) => line.replace(/^package:/, ''))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right));
      const visiblePackages = packages.slice(0, 25);
      const suffix =
        packages.length > visiblePackages.length
          ? `; ${packages.length - visiblePackages.length} more omitted`
          : '';
      return visiblePackages.length > 0
        ? `- Installed third-party packages (${visiblePackages.length}/${packages.length}): ${visiblePackages.join(', ')}${suffix}.`
        : '- Installed third-party packages: none reported.';
    } catch (error) {
      return `- Installed third-party packages: unavailable (${sanitizeAiText(error instanceof Error ? error.message : error, 300)}).`;
    }
  }

  private blockedToolResult(
    uses: string,
    toolCall: AutomationToolEnvelopeResult,
  ) {
    if (uses !== 'android.adbShell') {
      return null;
    }
    const command =
      typeof toolCall.input.command === 'string' ? toolCall.input.command : '';
    if (!isDangerousAdbShellCommand(command)) {
      return null;
    }
    return {
      summary:
        'This adbShell command is blocked because it may modify device state dangerously. Ask the user for a safer route.',
      error:
        'Potentially destructive adbShell command blocked during AI automation.',
      expectedIntent: toolCall.intent.length > 0 ? toolCall.intent : undefined,
      expectedOutcome:
        toolCall.expectedOutcome.length > 0
          ? toolCall.expectedOutcome
          : undefined,
      envelopeValid: toolCall.envelopeValid,
    };
  }

  private parseToolCallArguments(
    uses: string,
    rawArguments: Record<string, unknown>,
  ): AutomationToolEnvelopeResult {
    if (!this.isObjectRecord(rawArguments)) {
      return {
        intent: `Legacy tool call shape for ${uses}.`,
        expectedOutcome: 'Model returned a malformed tool argument object.',
        input: {},
        envelopeValid: false,
      };
    }
    const hasEnvelope =
      typeof rawArguments.intent === 'string' &&
      typeof rawArguments.expectedOutcome === 'string' &&
      rawArguments.input != null &&
      typeof rawArguments.input === 'object' &&
      !Array.isArray(rawArguments.input);
    const requiresScreenObservation =
      typeof rawArguments.requiresScreenObservation === 'boolean'
        ? rawArguments.requiresScreenObservation
        : undefined;
    const requiresScreenObservationWellFormed =
      uses !== 'android.adbShell'
        ? true
        : rawArguments.requiresScreenObservation === undefined ||
          typeof rawArguments.requiresScreenObservation === 'boolean';
    if (!hasEnvelope) {
      return {
        intent:
          typeof rawArguments.intent === 'string'
            ? sanitizeAiText(rawArguments.intent, 140)
            : `Legacy tool call for ${uses}.`,
        expectedOutcome:
          typeof rawArguments.expectedOutcome === 'string'
            ? sanitizeAiText(rawArguments.expectedOutcome, 220)
            : 'No explicit expected outcome was supplied.',
        input: rawArguments,
        requiresScreenObservation:
          uses === 'android.adbShell' ? true : undefined,
        envelopeValid: false,
      };
    }
    return {
      intent: sanitizeAiText(rawArguments.intent, 140),
      expectedOutcome: sanitizeAiText(rawArguments.expectedOutcome, 220),
      input: rawArguments.input as Record<string, unknown>,
      requiresScreenObservation:
        uses === 'android.adbShell'
          ? (requiresScreenObservation ?? true)
          : undefined,
      envelopeValid: hasEnvelope && requiresScreenObservationWellFormed,
    };
  }

  private isObjectRecord(value: unknown): value is Record<string, unknown> {
    return value != null && typeof value === 'object' && !Array.isArray(value);
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
