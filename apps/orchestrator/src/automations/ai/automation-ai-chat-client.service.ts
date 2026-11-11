import {
  BadRequestException,
  Injectable,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common';
import {
  withProviderChatResponse,
  providerProtocol,
  type ChatResponseFormat,
  type ChatMessage,
} from '../../common/ai-provider-request';
import {
  consumeChatCompletionStream,
  providerStreamFormat,
} from '../../common/ai-provider-stream';
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
} from '../../settings/contracts/ai-provider';
import {
  providerErrorDetailFromText,
  sanitizeAiText,
} from './automation-ai-observation.utils';
import { MetricsService } from '../../metrics/metrics.service';
import {
  ProviderRequestAbort,
  readBoundedProviderText,
} from '../../common/ai-provider-http';

@Injectable()
export class AutomationAiChatClientService {
  private readonly logger = new Logger(AutomationAiChatClientService.name);

  constructor(
    private readonly metrics: MetricsService = new MetricsService(),
  ) {}

  async chat({
    provider,
    model,
    messages,
    tools,
    deadline,
    abortSignal,
    onContentDelta,
    responseFormat,
  }: {
    provider: AutomationAiProvider;
    model: AutomationAiProviderModel;
    messages: ChatMessage[];
    tools: unknown[];
    deadline: number;
    abortSignal?: AbortSignal;
    onContentDelta?: (delta: string) => Promise<void>;
    responseFormat?: ChatResponseFormat;
  }): Promise<AutomationAiChatResponse> {
    const finishMetrics = this.metrics.beginAiProviderRequest(
      'chat',
      'controller',
    );
    try {
      const result = await withProviderChatResponse(
        { provider, model, messages, responseFormat, tools, stream: true },
        { deadline, abortSignal },
        async (response) => {
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
          return this.consumeStream(
            response.body,
            providerStreamFormat(provider),
            onContentDelta,
          );
        },
      );
      finishMetrics('success');
      return {
        choices: [{ message: result.message }],
        generation: {
          reasoningPresent: result.reasoningPresent,
          finishReason: result.finishReason ?? null,
          usage: result.usage ?? null,
          timings: result.timings ?? null,
          protocol: providerProtocol(provider),
        },
      };
    } catch (error) {
      finishMetrics(
        error instanceof ProviderRequestAbort && error.kind === 'timeout'
          ? 'timeout'
          : 'error',
      );
      if (error instanceof ProviderRequestAbort) {
        if (error.kind === 'canceled') {
          throw new BadRequestException('AI automation was canceled.');
        }
        throw new RequestTimeoutException(
          'AI automation timed out waiting for the provider response.',
        );
      }
      throw error;
    }
  }

  private async readProviderError(response: Response) {
    const text = await readBoundedProviderText(response);
    return providerErrorDetailFromText(text);
  }

  private async consumeStream(
    body: ReadableStream<Uint8Array>,
    format: 'openai-sse' | 'ollama-ndjson',
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
      format,
      onUpdate: async ({ contentDelta }) => {
        if (!contentDelta) return;
        pendingDelta += contentDelta;
        await flush(false);
      },
    });
    await flush(true);
    return result;
  }
}

export interface AutomationAiChatResponse {
  choices: Array<{ message: ChatMessage }>;
  generation?: {
    reasoningPresent: boolean;
    finishReason: string | null;
    usage: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    } | null;
    timings: {
      promptMs?: number;
      predictedMs?: number;
      cacheTokens?: number;
    } | null;
    protocol: 'openai-chat-completions' | 'ollama-native-chat';
  };
}
