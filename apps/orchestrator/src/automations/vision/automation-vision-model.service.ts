import { matchesVisionLocateBounds } from './vision-geometry';
import {
  BadRequestException,
  Injectable,
  RequestTimeoutException,
} from '@nestjs/common';
import { createDetection } from './vision-observation';
import {
  providerAssistantMessage,
  withProviderChatResponse,
  type ChatMessage,
} from '../../common/ai-provider-request';
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
} from '../../settings/contracts/ai-provider';
import {
  ProviderRequestAbort,
  readProviderJson,
  readBoundedProviderText,
} from '../../common/ai-provider-http';
import { MetricsService } from '../../metrics/metrics.service';
import {
  providerErrorDetailFromText,
  sanitizeAiText,
} from '../ai/automation-ai-observation.utils';
import { textContent } from '../ai/automation-ai-message.utils';
import type { OptimizedAiScreenshot } from '../ai/automation-ai-screenshot.utils';
import type {
  AutomationVisionContext,
  AutomationVisionDescription,
  AutomationVisionLocateInput,
  AutomationVisionModelLocateResult,
  AutomationVisionScreenState,
} from './automation-vision.types';
import {
  parseVisionLocateResponse,
  parseVisionScreenStateResponse,
} from './automation-vision-model-response';

interface VisionModelRequest {
  image: OptimizedAiScreenshot;
  abortSignal?: AbortSignal;
  deadline?: number;
  provider: AutomationAiProvider;
  model: AutomationAiProviderModel;
}

@Injectable()
export class AutomationVisionModelService {
  constructor(private readonly metrics: MetricsService) {}

  async describeSafe(
    request: VisionModelRequest & { visionContext?: AutomationVisionContext },
  ): Promise<AutomationVisionDescription> {
    try {
      const screenState = await this.describe(request);
      return { screenState, summary: screenState.summary };
    } catch (error) {
      return {
        visionSummaryError: sanitizeAiText(
          error instanceof Error ? error.message : String(error),
          3_000,
        ),
      };
    }
  }

  async locateSafe(
    request: VisionModelRequest & { input: AutomationVisionLocateInput },
  ): Promise<AutomationVisionModelLocateResult> {
    try {
      return await this.locate(request);
    } catch (error) {
      return {
        matches: [],
        failed: true,
        reason: sanitizeAiText(
          error instanceof Error ? error.message : String(error),
          600,
        ),
      };
    }
  }

  private async describe(
    request: VisionModelRequest & { visionContext?: AutomationVisionContext },
  ): Promise<AutomationVisionScreenState> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: [
          'You are a visual screen description model for Android automation.',
          'Return JSON only. Do not request tools.',
          'Treat app/screen identity as uncertain unless visible text, title, or distinctive controls support it.',
          'Inspect icons and contextual clues, including gear/settings icons, but report them as candidate controls unless app identity is confirmed.',
          'List icon-only controls when they are visually important. Use cautious labels such as "settings access gear candidate" with confidence and evidence.',
          'A quick-settings shade with brightness slider, Internet/Bluetooth tiles, power button, edit pencil, or status-shade layout is quick_settings, not settings_app. A gear icon there means settings access is visible, not that Settings is open.',
          'An app drawer shows an app grid/list, app search, "All apps", or installed app icons/labels. Classify that as app_drawer, not home.',
          'Use screenKind values: home, app_drawer, quick_settings, notification_shade, settings_app, app_screen, unknown.',
          'Use normalized 0..1 bounds for controls only when visually clear.',
          request.model.settings.systemPrompt,
        ]
          .filter(Boolean)
          .join('\n'),
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'Describe this Android screen for a separate automation planner.',
              request.visionContext
                ? `Task context: ${JSON.stringify({
                    goal: request.visionContext.goal ?? null,
                    lastAction: request.visionContext.lastAction ?? null,
                    expectedOutcome:
                      request.visionContext.expectedOutcome ?? null,
                    confirmedFacts: (
                      request.visionContext.confirmedFacts ?? []
                    ).slice(-8),
                    latestHypothesis:
                      request.visionContext.latestHypothesis ?? null,
                  })}`
                : '',
              'JSON shape: {"screenKind":"home|app_drawer|quick_settings|notification_shade|settings_app|app_screen|unknown","confidence":0.0,"visibleText":["..."],"controls":[{"label":"...","role":"button|icon|text|field|tile|unknown","bounds":{"left":0,"top":0,"width":0,"height":0},"confidence":0.0,"evidence":["..."]}],"evidence":["..."],"uncertainty":["..."],"summary":"one concise factual sentence"}.',
              'If the screen could be multiple things, choose unknown or low confidence and explain uncertainty.',
            ]
              .filter(Boolean)
              .join('\n'),
          },
          { type: 'image_url', image_url: { url: request.image.dataUrl } },
        ],
      },
    ];
    return parseVisionScreenStateResponse(
      await this.requestText(request, messages, 'Vision provider request'),
    );
  }

  private async locate(
    request: VisionModelRequest & { input: AutomationVisionLocateInput },
  ): Promise<AutomationVisionModelLocateResult> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: [
          'You locate visible Android UI targets for automation.',
          'Return JSON only. Do not request tools.',
          'Use normalized 0..1 bounds. If the requested target is not visible, return no matches and explain why.',
          request.model.settings.systemPrompt,
        ]
          .filter(Boolean)
          .join('\n'),
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              `Find visible target: ${request.input.query}`,
              ...(request.input.region
                ? [
                    `Only search inside this normalized region: ${JSON.stringify(request.input.region)}.`,
                  ]
                : []),
              `Return at most ${request.input.maxResults} match(es) with confidence >= ${request.input.threshold}.`,
              'JSON shape: {"matches":[{"label":"...","description":"...","confidence":0.0,"bounds":{"left":0,"top":0,"width":0,"height":0}}],"reason":"..."}',
            ].join('\n'),
          },
          { type: 'image_url', image_url: { url: request.image.dataUrl } },
        ],
      },
    ];
    const parsed = parseVisionLocateResponse(
      await this.requestText(request, messages, 'Vision locate request'),
    );
    const matches = parsed.matches
      .map((match, index) =>
        createDetection({
          id: `vision-${index + 1}`,
          label: match.label,
          description: match.description,
          confidence: match.confidence,
          bounds: match.bounds,
          source: 'vision-model',
        }),
      )
      .filter((detection) =>
        matchesVisionLocateBounds(detection, request.input),
      )
      .slice(0, request.input.maxResults);
    return {
      matches,
      ...(matches.length === 0 || parsed.reason
        ? { reason: parsed.reason || 'Vision model found no visible match.' }
        : {}),
    };
  }

  private async requestText(
    request: VisionModelRequest,
    messages: ChatMessage[],
    failurePrefix: string,
  ) {
    const finishMetrics = this.metrics.beginAiProviderRequest('chat', 'vision');
    try {
      const content = await withProviderChatResponse(
        {
          provider: request.provider,
          model: request.model,
          messages,
          stream: false,
        },
        {
          abortSignal: request.abortSignal,
          deadline: request.deadline,
          timeoutMs: 30_000,
        },
        async (response) => {
          if (!response.ok) {
            const detail = providerErrorDetailFromText(
              await readBoundedProviderText(response),
            );
            throw new BadRequestException(
              `${failurePrefix} failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`,
            );
          }
          const message = providerAssistantMessage(
            await readProviderJson(response),
          );
          return textContent(message?.content);
        },
      );
      finishMetrics('success');
      return content;
    } catch (error) {
      const timedOut =
        error instanceof ProviderRequestAbort && error.kind === 'timeout';
      finishMetrics(timedOut ? 'timeout' : 'error');
      if (error instanceof ProviderRequestAbort && error.kind === 'canceled') {
        throw new BadRequestException(
          'Automation vision operation was canceled.',
        );
      }
      if (timedOut) {
        throw new RequestTimeoutException('Vision provider request timed out.');
      }
      throw error;
    }
  }
}
