import {
  BadRequestException,
  Injectable,
  RequestTimeoutException,
} from '@nestjs/common';
import { createDetection } from '@rebroid/vision-core/observation';
import {
  buildChatRequestBody,
  chatCompletionsEndpoint,
  correctScreenStateHypothesis,
  type ChatMessage,
} from '@rebroid/ai-core/harness';
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
} from '@rebroid/ai-core/provider';
import {
  createProviderRequestScope,
  isProviderAbortError,
  providerRequestHeaders,
  readBoundedProviderText,
} from '@rebroid/ai-core/provider-http';
import { MetricsService } from '../../metrics/metrics.service';
import {
  providerErrorDetailFromText,
  sanitizeAiText,
} from '../ai/automation-ai-observation.utils';
import { textContent } from '../ai/automation-ai-message.utils';
import type { OptimizedAiScreenshot } from '../ai/automation-ai-screenshot.utils';
import type {
  AutomationVisionContext,
  AutomationVisionLocateInput,
  AutomationVisionLocateOutput,
  AutomationVisionScreenState,
} from './automation-vision.types';
import type { AutomationVisionDescription } from './automation-vision-fusion.service';

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
  ): Promise<AutomationVisionLocateOutput> {
    try {
      return await this.locate(request);
    } catch (error) {
      return {
        matches: [],
        query: request.input.query,
        threshold: request.input.threshold,
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
  ): Promise<AutomationVisionLocateOutput> {
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
      .filter((match) => match.confidence >= request.input.threshold)
      .slice(0, request.input.maxResults)
      .map((match, index) =>
        createDetection({
          id: `vision-${index + 1}`,
          label: match.label,
          description: match.description,
          confidence: match.confidence,
          bounds: match.bounds,
          source: 'vision-model',
        }),
      );
    return {
      matches,
      query: request.input.query,
      threshold: request.input.threshold,
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
    const scope = createProviderRequestScope({
      abortSignal: request.abortSignal,
      deadline: request.deadline,
      timeoutMs: 30_000,
    });
    try {
      const response = await fetch(chatCompletionsEndpoint(request.provider), {
        method: 'POST',
        signal: scope.signal,
        headers: providerRequestHeaders(request.provider, { json: true }),
        body: JSON.stringify(
          buildChatRequestBody({
            provider: request.provider,
            model: request.model,
            messages,
            stream: false,
          }),
        ),
      });
      if (!response.ok) {
        const detail = providerErrorDetailFromText(
          await readBoundedProviderText(response),
        );
        throw new BadRequestException(
          `${failurePrefix} failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`,
        );
      }
      const body = (await response.json().catch(() => null)) as {
        choices?: Array<{ message?: ChatMessage }>;
      } | null;
      finishMetrics('success');
      return textContent(body?.choices?.[0]?.message?.content ?? null);
    } catch (error) {
      const timedOut = scope.wasTimedOut() || isProviderAbortError(error);
      finishMetrics(timedOut ? 'timeout' : 'error');
      if (scope.wasCanceled()) {
        throw new BadRequestException(
          'Automation vision operation was canceled.',
        );
      }
      if (timedOut) {
        throw new RequestTimeoutException('Vision provider request timed out.');
      }
      throw error;
    } finally {
      scope.cleanup();
    }
  }
}

interface VisionLocateModelMatch {
  label?: string;
  description?: string;
  confidence: number;
  bounds: { left: number; top: number; width: number; height: number };
}

const screenKinds = new Set([
  'home',
  'app_drawer',
  'quick_settings',
  'notification_shade',
  'settings_app',
  'app_screen',
  'unknown',
]);

const parseVisionScreenStateResponse = (
  text: string,
): AutomationVisionScreenState => {
  const parsed = parseJsonObject(extractJsonObject(text));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      screenKind: 'unknown',
      confidence: 0.25,
      visibleText: [],
      controls: [],
      evidence: [],
      uncertainty: ['Vision model did not return structured JSON.'],
      summary: sanitizeAiText(text || 'Vision model returned no summary.', 800),
    };
  }
  const record = parsed as Record<string, unknown>;
  const requestedKind =
    typeof record.screenKind === 'string' ? record.screenKind : 'unknown';
  const rawScreenKind = screenKinds.has(requestedKind)
    ? (requestedKind as AutomationVisionScreenState['screenKind'])
    : 'unknown';
  const rawSummary =
    typeof record.summary === 'string'
      ? sanitizeAiText(record.summary, 800)
      : sanitizeAiText(text, 800);
  const baseState: AutomationVisionScreenState = {
    screenKind: rawScreenKind,
    confidence: clamp01(Number(record.confidence)),
    visibleText: stringArray(record.visibleText, 30, 120),
    controls: (Array.isArray(record.controls) ? record.controls : []).flatMap(
      normalizeVisionControl,
    ),
    evidence: stringArray(record.evidence, 12, 180),
    uncertainty: stringArray(record.uncertainty, 12, 180),
    summary: rawSummary,
  };
  const correction = correctScreenStateHypothesis(baseState);
  return {
    ...baseState,
    controls: withSettingsAccessControl(
      baseState.controls,
      correction.settingsAccessVisible,
    ),
    screenKind: correction.screenKind,
    confidence: correction.confidence,
    settingsAccessVisible: correction.settingsAccessVisible,
    ...(correction.screenKind !== rawScreenKind
      ? {
          rawScreenKind,
          rawSummary,
          correctionReason: correction.correctionReason,
          uncertainty: [
            ...baseState.uncertainty,
            correction.correctionReason ??
              'Screen kind was corrected by deterministic policy.',
          ].slice(0, 12),
        }
      : {}),
  };
};

const withSettingsAccessControl = (
  controls: AutomationVisionScreenState['controls'],
  settingsAccessVisible: boolean,
) => {
  if (!settingsAccessVisible) return controls;
  if (
    controls.some((control) =>
      /\b(settings?|gear|cog|settings access)\b/i.test(control.label),
    )
  ) {
    return controls;
  }
  return [
    {
      label: 'Settings access candidate',
      role: 'icon',
      confidence: 0.5,
      evidence: ['Screen-state evidence mentions settings or gear access.'],
    },
    ...controls,
  ].slice(0, 30);
};

const normalizeVisionControl = (
  value: unknown,
): AutomationVisionScreenState['controls'] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  const label =
    typeof record.label === 'string' ? sanitizeAiText(record.label, 120) : '';
  if (!label) return [];
  const bounds =
    record.bounds && typeof record.bounds === 'object'
      ? (record.bounds as Record<string, unknown>)
      : null;
  const values = [
    Number(bounds?.left),
    Number(bounds?.top),
    Number(bounds?.width),
    Number(bounds?.height),
  ];
  const normalizedBounds =
    values.every(Number.isFinite) &&
    values[0] >= 0 &&
    values[1] >= 0 &&
    values[2] > 0 &&
    values[3] > 0
      ? { left: values[0], top: values[1], width: values[2], height: values[3] }
      : undefined;
  return [
    {
      label,
      ...(typeof record.role === 'string'
        ? { role: sanitizeAiText(record.role, 40) }
        : {}),
      ...(normalizedBounds ? { bounds: normalizedBounds } : {}),
      ...(Number.isFinite(Number(record.confidence))
        ? { confidence: clamp01(Number(record.confidence)) }
        : {}),
      ...(Array.isArray(record.evidence)
        ? { evidence: stringArray(record.evidence, 4, 120) }
        : {}),
    },
  ];
};

const parseVisionLocateResponse = (text: string) => {
  const parsed = parseJsonObject(extractJsonObject(text));
  const record =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  const matches = Array.isArray(record.matches) ? record.matches : [];
  return {
    matches: matches.flatMap((match): VisionLocateModelMatch[] => {
      if (!match || typeof match !== 'object') return [];
      const item = match as Record<string, unknown>;
      const bounds =
        item.bounds && typeof item.bounds === 'object'
          ? (item.bounds as Record<string, unknown>)
          : null;
      const values = [
        Number(bounds?.left),
        Number(bounds?.top),
        Number(bounds?.width),
        Number(bounds?.height),
        Number(item.confidence),
      ];
      if (!values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) {
        return [];
      }
      return [
        {
          label:
            typeof item.label === 'string'
              ? sanitizeAiText(item.label, 120)
              : 'Visual match',
          description:
            typeof item.description === 'string'
              ? sanitizeAiText(item.description, 240)
              : undefined,
          confidence: values[4],
          bounds: {
            left: values[0],
            top: values[1],
            width: values[2],
            height: values[3],
          },
        },
      ];
    }),
    ...(typeof record.reason === 'string'
      ? { reason: sanitizeAiText(record.reason, 500) }
      : {}),
  };
};

const stringArray = (value: unknown, maxItems: number, maxLength: number) =>
  (Array.isArray(value) ? value : [])
    .filter((item): item is string => typeof item === 'string')
    .slice(0, maxItems)
    .map((item) => sanitizeAiText(item, maxLength));

const clamp01 = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

const extractJsonObject = (text: string) => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
};

const parseJsonObject = (text: string) => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};
