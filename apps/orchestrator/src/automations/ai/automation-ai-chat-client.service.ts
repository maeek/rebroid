import {
  BadRequestException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common';
import {
  buildChatRequestBody,
  chatCompletionsEndpoint,
  consumeChatCompletionStream,
  type ChatMessage,
} from '@rebroid/ai-core/harness';
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
} from '@rebroid/ai-core/provider';
import {
  providerErrorDetailFromText,
  sanitizeAiText,
} from './automation-ai-observation.utils';

@Injectable()
export class AutomationAiChatClientService {
  private readonly logger = new Logger(AutomationAiChatClientService.name);

  async chat({
    provider,
    model,
    messages,
    tools,
    deadline,
    abortSignal,
    onContentDelta,
  }: {
    provider: AutomationAiProvider;
    model: AutomationAiProviderModel;
    messages: ChatMessage[];
    tools: unknown[];
    deadline: number;
    abortSignal?: AbortSignal;
    onContentDelta?: (delta: string) => Promise<void>;
  }) {
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
}
