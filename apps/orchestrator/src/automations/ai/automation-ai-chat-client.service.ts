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
  type ChatCompletionStreamResult,
} from '../../common/ai-provider-stream';
import {
  consumeOpenAiResponsesStream,
  withOpenAiResponsesStream,
  type OpenAiResponsesHistory,
} from '../../common/openai-responses';
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
    responsesHistory,
    role = 'controller',
  }: {
    provider: AutomationAiProvider;
    model: AutomationAiProviderModel;
    messages: ChatMessage[];
    tools: unknown[];
    deadline: number;
    abortSignal?: AbortSignal;
    onContentDelta?: (delta: string) => Promise<void>;
    responseFormat?: ChatResponseFormat;
    responsesHistory?: OpenAiResponsesHistory;
    role?: 'controller' | 'planner';
  }): Promise<AutomationAiChatResponse> {
    const finishMetrics = this.metrics.beginAiProviderRequest('chat', role);
    try {
      const consume = async (response: Response) => {
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
        const body = response.body;
        return this.consumeStream(onContentDelta, (onDelta) =>
          responsesHistory
            ? consumeOpenAiResponsesStream(body, responsesHistory, onDelta)
            : consumeChatCompletionStream({
                body,
                format: providerStreamFormat(provider),
                onUpdate: ({ contentDelta }) => onDelta(contentDelta),
              }),
        );
      };
      const options = { deadline, abortSignal };
      const result = await (responsesHistory
        ? withOpenAiResponsesStream(
            {
              provider,
              model: model.id,
              messages,
              tools,
              history: responsesHistory,
            },
            options,
            consume,
          )
        : withProviderChatResponse(
            { provider, model, messages, responseFormat, tools, stream: true },
            options,
            consume,
          ));
      finishMetrics('success');
      return {
        choices: [{ message: result.message }],
        generation: {
          reasoningPresent: result.reasoningPresent,
          finishReason: result.finishReason ?? null,
          usage: result.usage ?? null,
          timings: result.timings ?? null,
          protocol: responsesHistory
            ? 'openai-responses'
            : providerProtocol(provider),
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
    onContentDelta: ((delta: string) => Promise<void>) | undefined,
    consume: (
      onDelta: (delta: string) => Promise<void>,
    ) => Promise<ChatCompletionStreamResult>,
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

    const result = await consume(async (contentDelta) => {
      if (!contentDelta) return;
      pendingDelta += contentDelta;
      await flush(false);
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
    protocol:
      'openai-chat-completions' | 'openai-responses' | 'ollama-native-chat';
  };
}
