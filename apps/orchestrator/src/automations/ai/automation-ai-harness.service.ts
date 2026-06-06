import {
  BadRequestException,
  Injectable,
  RequestTimeoutException,
} from '@nestjs/common';
import {
  allowedToolMatcher,
  buildChatRequestBody,
  buildInitialMessages,
  buildScreenshotObservationMessage,
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

const SCREEN_MUTATING_TOOLS = new Set([
  'android.adbShell',
  'android.inputText',
  'android.key',
  'android.rotateDisplay',
  'android.setClipboard',
  'android.swipe',
  'android.tap',
  'android.viewerCommand',
]);

const textContent = (content: ChatMessage['content']) =>
  typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content
          .filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join('\n')
      : '';

const sanitizeToolData = (data: Record<string, unknown> = {}) =>
  Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      key === 'dataUrl' && typeof value === 'string'
        ? '[redacted image data]'
        : value,
    ]),
  );

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
    if (!model.supportsTools) {
      throw new BadRequestException(
        `AI model "${model.id}" does not support tool calls.`,
      );
    }
    if (!model.supportsVision) {
      throw new BadRequestException(
        `AI model "${model.id}" does not support screenshots. Select a vision-capable model for Android automation.`,
      );
    }

    const deadline = Date.now() + input.timeoutMs;
    const commands = this.registry.listCommands();
    const allowed = allowedToolMatcher(input.allowedTools);
    const tools = buildToolDefinitions(commands, allowed);
    const usesByToolName = mapUsesByToolName(commands);

    await this.emit(context, 'ai.user.message', input.prompt, {
      clientMessageId: input.clientMessageId ?? null,
    });
    const initialScreenshot = input.initialScreenshotDataUrl
      ? {
          dataUrl: input.initialScreenshotDataUrl,
          mimeType: 'image/png',
          capturedAt: new Date().toISOString(),
        }
      : await this.captureScreenshot(context, 'Initial screenshot captured.', {
          clientMessageId: input.clientMessageId,
          reason: 'initial',
        });
    const messages = buildInitialMessages(
      { ...input, initialScreenshotDataUrl: initialScreenshot.dataUrl },
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
          arguments: args,
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
          const sanitizedData = sanitizeToolData(result.data);
          await this.emit(context, 'ai.tool.completed', result.summary, {
            uses,
            output: sanitizedData,
            clientMessageId: input.clientMessageId ?? null,
          });
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({
              summary: result.summary,
              ...sanitizedData,
            }),
          });

          const toolScreenshot = screenshotFromData(result.data);
          if (toolScreenshot) {
            await this.emitScreenshot(context, {
              ...toolScreenshot,
              summary: 'Screenshot captured by tool.',
              clientMessageId: input.clientMessageId,
              reason: 'tool',
            });
            messages.push(
              buildScreenshotObservationMessage({
                dataUrl: toolScreenshot.dataUrl,
                summary: 'Screenshot captured by tool.',
              }),
            );
          } else if (SCREEN_MUTATING_TOOLS.has(uses)) {
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
            error instanceof Error ? error.message : 'Tool call failed.';
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
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Math.max(1, deadline - Date.now()),
    );
    const onAbort = () => controller.abort();
    abortSignal?.addEventListener('abort', onAbort, { once: true });
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
      abortSignal?.removeEventListener('abort', onAbort);
      clearTimeout(timeout);
    }
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
      const result = await context.adb.screenshot(context.app);
      await this.emitScreenshot(context, {
        dataUrl: result.dataUrl,
        mimeType: result.mimeType,
        capturedAt: result.capturedAt,
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

  private emitScreenshot(
    context: AutomationAiHarnessContext,
    input: {
      dataUrl: string;
      mimeType: string;
      capturedAt: string;
      summary: string;
      clientMessageId?: string;
      reason?: string;
      uses?: string;
    },
  ) {
    return this.emit(context, 'ai.screenshot.observed', input.summary, {
      dataUrl: input.dataUrl,
      mimeType: input.mimeType,
      capturedAt: input.capturedAt,
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
