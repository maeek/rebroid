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
  buildScreenshotObservationMessage,
  buildUiXmlObservationMessage,
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
  isImageInputUnsupportedProviderMessage,
  prepareUiXml,
  providerErrorDetailFromText,
  sanitizeAiDataForEvent,
  sanitizeAiDataForModel,
  sanitizeAiText,
} from './automation-ai-observation.utils';
import { optimizeAiScreenshot } from './automation-ai-screenshot.utils';
import type { AutomationAiHarnessContext } from './automation-ai.types';

type ObservationMode = 'screenshot' | 'ui-xml';
type ChatResponse = { choices?: Array<{ message?: ChatMessage }> };

const textContent = (content: ChatMessage['content']) =>
  typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content
          .filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join('\n')
      : '';

const screenshotFromData = (data?: Record<string, unknown>) => {
  const dataUrl = typeof data?.dataUrl === 'string' ? data.dataUrl : '';
  if (!dataUrl) return null;
  return {
    dataUrl,
    mimeType: typeof data?.mimeType === 'string' ? data.mimeType : 'image/png',
    capturedAt:
      typeof data?.capturedAt === 'string'
        ? data.capturedAt
        : new Date().toISOString(),
  };
};

@Injectable()
export class AutomationAiHarnessService {
  private readonly logger = new Logger(AutomationAiHarnessService.name);

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

    await this.emit(context, 'ai.user.message', input.prompt, {
      clientMessageId: input.clientMessageId ?? null,
    });
    const initialScreenshot = input.initialScreenshotDataUrl
      ? await this.prepareScreenshot({
          dataUrl: input.initialScreenshotDataUrl,
          mimeType: 'image/png',
          capturedAt: new Date().toISOString(),
        })
      : await this.captureScreenshot(context, 'Initial screenshot captured.', {
          clientMessageId: input.clientMessageId,
          reason: 'initial',
        });
    const messages = buildInitialMessages(
      { ...input, initialScreenshotDataUrl: initialScreenshot.dataUrl },
      model,
    );
    let observationMode: ObservationMode = 'screenshot';
    let toolCalls = 0;
    let finalText = '';

    await this.emit(context, 'ai.model.started', `Using ${provider.label}`, {
      providerId: provider.id,
      modelId: model.id,
      clientMessageId: input.clientMessageId ?? null,
    });

    while (Date.now() < deadline) {
      this.assertNotCanceled(context.abortSignal);
      let response: ChatResponse;
      try {
        response = await this.chat(
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
      } catch (error) {
        if (
          observationMode === 'screenshot' &&
          this.isImageInputUnsupportedError(error)
        ) {
          observationMode = 'ui-xml';
          await this.emit(
            context,
            'ai.guardrail.triggered',
            'Model rejected screenshot input. Falling back to UI hierarchy XML.',
            {
              clientMessageId: input.clientMessageId ?? null,
            },
          );
          const ui = await this.captureUiXml(
            context,
            'Initial UI hierarchy captured.',
            {
              clientMessageId: input.clientMessageId,
              reason: 'initial-fallback',
            },
          );
          messages.splice(
            0,
            messages.length,
            ...buildInitialMessages(
              {
                ...input,
                initialScreenshotDataUrl: undefined,
                initialUiXml: ui.xml,
              },
              model,
            ),
          );
          continue;
        }
        throw error;
      }
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

          const toolScreenshot = screenshotFromData(result.data);
          if (observationMode === 'ui-xml' && toolScreenshot) {
            const ui = await this.captureUiXml(
              context,
              'UI hierarchy captured instead of screenshot.',
              {
                clientMessageId: input.clientMessageId,
                reason: 'tool-fallback',
                uses,
              },
            );
            messages.push(
              buildUiXmlObservationMessage({
                xml: ui.xml,
                summary: 'UI hierarchy captured instead of screenshot.',
              }),
            );
          } else if (observationMode === 'screenshot' && toolScreenshot) {
            const screenshot = await this.prepareScreenshot(toolScreenshot);
            await this.emitScreenshot(context, {
              dataUrl: screenshot.dataUrl,
              mimeType: screenshot.mimeType,
              capturedAt: screenshot.capturedAt,
              optimized: screenshot.optimized,
              originalBytes: screenshot.originalBytes,
              bytes: screenshot.bytes,
              width: screenshot.width,
              height: screenshot.height,
              summary: 'Screenshot captured by tool.',
              clientMessageId: input.clientMessageId,
              reason: 'tool',
            });
            messages.push(
              buildScreenshotObservationMessage({
                dataUrl: screenshot.dataUrl,
                summary: 'Screenshot captured by tool.',
              }),
            );
          } else if (SCREEN_MUTATING_TOOLS.has(uses)) {
            if (observationMode === 'ui-xml') {
              const ui = await this.captureUiXml(
                context,
                `Fresh UI hierarchy captured after ${uses}.`,
                {
                  clientMessageId: input.clientMessageId,
                  reason: 'after-tool',
                  uses,
                },
              );
              messages.push(
                buildUiXmlObservationMessage({
                  xml: ui.xml,
                  summary: `Fresh UI hierarchy captured after ${uses}.`,
                }),
              );
              continue;
            }
            const screenshot = await this.captureScreenshot(
              context,
              `Fresh screenshot captured after ${uses}.`,
              {
                clientMessageId: input.clientMessageId,
                reason: 'after-tool',
                uses,
              },
            );
            messages.push(
              buildScreenshotObservationMessage({
                dataUrl: screenshot.dataUrl,
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
        force ||
        pendingDelta.length >= 160 ||
        Date.now() - lastFlushAt >= 150;
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

  private isImageInputUnsupportedError(error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : '';
    return isImageInputUnsupportedProviderMessage(message);
  }

  private isAbortError(error: unknown) {
    return error instanceof Error && error.name === 'AbortError';
  }

  private assertNotCanceled(abortSignal?: AbortSignal) {
    if (abortSignal?.aborted) {
      throw new BadRequestException('AI automation was canceled.');
    }
  }

  private async captureScreenshot(
    context: AutomationAiHarnessContext,
    summary: string,
    data: Record<string, unknown> = {},
  ) {
    try {
      const result = await this.prepareScreenshot(
        await context.adb.screenshot(context.app),
      );
      await this.emitScreenshot(context, {
        dataUrl: result.dataUrl,
        mimeType: result.mimeType,
        capturedAt: result.capturedAt,
        optimized: result.optimized,
        originalBytes: result.originalBytes,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        summary,
        clientMessageId:
          typeof data.clientMessageId === 'string'
            ? data.clientMessageId
            : undefined,
        reason: typeof data.reason === 'string' ? data.reason : undefined,
        uses: typeof data.uses === 'string' ? data.uses : undefined,
      });
      return result;
    } catch (error) {
      const message =
        error instanceof Error
          ? `Screenshot capture failed: ${error.message}`
          : 'Screenshot capture failed.';
      await this.emit(context, 'ai.tool.failed', message, {
        uses: 'android.screenshot',
        clientMessageId:
          typeof data.clientMessageId === 'string'
            ? data.clientMessageId
            : null,
      });
      throw new BadRequestException(message);
    }
  }

  private async captureUiXml(
    context: AutomationAiHarnessContext,
    summary: string,
    data: Record<string, unknown> = {},
  ) {
    try {
      const result = await context.adb.dumpUi(context.app);
      const prepared = prepareUiXml(result.xml);
      await this.emit(context, 'ai.ui.observed', summary, {
        bytes: Buffer.byteLength(prepared.xml),
        nodeCount: prepared.nodeCount,
        truncated: prepared.truncated,
        originalBytes: Buffer.byteLength(result.xml),
        dumpedAt: result.dumpedAt,
        clientMessageId:
          typeof data.clientMessageId === 'string'
            ? data.clientMessageId
            : null,
        reason: typeof data.reason === 'string' ? data.reason : null,
        uses: typeof data.uses === 'string' ? data.uses : null,
      });
      return {
        ...prepared,
        dumpedAt: result.dumpedAt,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? `UI hierarchy dump failed: ${error.message}`
          : 'UI hierarchy dump failed.';
      await this.emit(context, 'ai.tool.failed', message, {
        uses: 'android.dumpUi',
        clientMessageId:
          typeof data.clientMessageId === 'string'
            ? data.clientMessageId
            : null,
      });
      throw new BadRequestException(message);
    }
  }

  private prepareScreenshot(input: {
    dataUrl: string;
    mimeType: string;
    capturedAt: string;
  }) {
    return optimizeAiScreenshot(input);
  }

  private async emitScreenshot(
    context: AutomationAiHarnessContext,
    input: {
      dataUrl: string;
      mimeType: string;
      capturedAt: string;
      optimized?: boolean;
      originalBytes?: number;
      bytes?: number;
      width?: number | null;
      height?: number | null;
      summary: string;
      clientMessageId?: string;
      reason?: string;
      uses?: string;
    },
  ) {
    return this.emit(context, 'ai.screenshot.observed', input.summary, {
      mimeType: input.mimeType,
      capturedAt: input.capturedAt,
      optimized: input.optimized ?? false,
      originalBytes: input.originalBytes ?? null,
      bytes: input.bytes ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      clientMessageId: input.clientMessageId ?? null,
      reason: input.reason ?? null,
      uses: input.uses ?? null,
    });
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
