import { BadRequestException, Injectable } from '@nestjs/common';
import { pointWithinBox } from '@rebroid/vision-core/geometry';
import {
  createDetection,
  extractUiDetections,
  matchesDetectionQuery,
  sortDetections,
} from '@rebroid/vision-core/observation';
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
} from '@rebroid/ai-core/provider';
import {
  buildChatRequestBody,
  chatCompletionsEndpoint,
  type ChatMessage,
} from '@rebroid/ai-core/harness';
import type { AutomationCommandContext } from '../commands/automation-command.types';
import {
  prepareUiXml,
  providerErrorDetailFromText,
  sanitizeAiText,
} from '../ai/automation-ai-observation.utils';
import { optimizeAiScreenshot } from '../ai/automation-ai-screenshot.utils';
import type {
  AutomationScreenObservation,
  AutomationVisionLocateInput,
  AutomationVisionLocateOutput,
} from './automation-vision.types';

@Injectable()
export class AutomationVisionService {
  async observe(
    context: Pick<AutomationCommandContext, 'adb' | 'app' | 'abortSignal'>,
    visionModel?: {
      provider: AutomationAiProvider;
      model: AutomationAiProviderModel;
    },
    deadline?: number,
  ): Promise<AutomationScreenObservation> {
    this.assertNotCanceled(context.abortSignal);
    const screenshot = await context.adb.screenshot(context.app);
    const aiImage = await optimizeAiScreenshot(screenshot);
    const ui = await context.adb
      .dumpUi(context.app)
      .catch((error: unknown) => ({
        error:
          error instanceof Error ? error.message : 'UI hierarchy dump failed.',
      }));
    const image = {
      width: aiImage.width ?? 1,
      height: aiImage.height ?? 1,
      mimeType: screenshot.mimeType,
      capturedAt: screenshot.capturedAt,
      source: 'screenshot' as const,
    };
    const uiDumpAvailable = 'xml' in ui;
    const preparedUi = uiDumpAvailable ? prepareUiXml(ui.xml) : null;
    const detections = preparedUi
      ? extractUiDetections(preparedUi.xml, image)
      : [];
    const uiXml = preparedUi
      ? {
          bytes: Buffer.byteLength(preparedUi.xml),
          nodeCount: preparedUi.nodeCount,
          status:
            preparedUi.nodeCount > 0
              ? ('available' as const)
              : ('empty' as const),
          truncated: preparedUi.truncated,
        }
      : {
          bytes: 0,
          error: uiDumpAvailable ? undefined : ui.error,
          nodeCount: 0,
          status: 'failed' as const,
          truncated: false,
        };
    const { summary, visionSummaryError } = visionModel
      ? await this.describeWithVisionModelSafe({
          aiImage,
          context,
          deadline,
          ...visionModel,
        })
      : { summary: undefined, visionSummaryError: undefined };

    return {
      image,
      aiImage,
      detections: sortDetections(detections).slice(0, 80),
      ...(summary ? { summary } : {}),
      ...(visionSummaryError ? { visionSummaryError } : {}),
      uiXml,
    };
  }

  private async describeWithVisionModelSafe({
    aiImage,
    context,
    deadline,
    model,
    provider,
  }: {
    aiImage: NonNullable<AutomationScreenObservation['aiImage']>;
    context: Pick<AutomationCommandContext, 'abortSignal'>;
    deadline?: number;
    provider: AutomationAiProvider;
    model: AutomationAiProviderModel;
  }): Promise<{ summary?: string; visionSummaryError?: string }> {
    try {
      return {
        summary: await this.describeWithVisionModel({
          aiImage,
          context,
          deadline,
          model,
          provider,
        }),
      };
    } catch (error) {
      return {
        visionSummaryError: sanitizeAiText(
          error instanceof Error ? error.message : String(error),
          3_000,
        ),
      };
    }
  }

  async locate(
    context: Pick<AutomationCommandContext, 'adb' | 'app' | 'abortSignal'>,
    input: AutomationVisionLocateInput,
    visionModel?: {
      provider: AutomationAiProvider;
      model: AutomationAiProviderModel;
    },
    deadline?: number,
  ): Promise<AutomationVisionLocateOutput> {
    const observation = await this.observe(context, undefined, deadline);
    const region = input.region;
    const matches = sortDetections(
      observation.detections.filter((detection) => {
        if (detection.confidence < input.threshold) return false;
        if (!matchesDetectionQuery(detection, input.query)) return false;
        return region ? pointWithinBox(detection.center, region) : true;
      }),
    ).slice(0, input.maxResults);
    if (matches.length === 0 && visionModel && observation.aiImage) {
      return this.locateWithVisionModelSafe({
        aiImage: observation.aiImage,
        context,
        deadline,
        input,
        ...visionModel,
      });
    }

    return {
      matches,
      query: input.query,
      threshold: input.threshold,
      ...(matches.length === 0
        ? {
            reason:
              'No matching UI hierarchy elements were found on the current screen.',
          }
        : {}),
    };
  }

  private async locateWithVisionModelSafe({
    aiImage,
    context,
    deadline,
    input,
    model,
    provider,
  }: {
    aiImage: NonNullable<AutomationScreenObservation['aiImage']>;
    context: Pick<AutomationCommandContext, 'abortSignal'>;
    deadline?: number;
    input: AutomationVisionLocateInput;
    provider: AutomationAiProvider;
    model: AutomationAiProviderModel;
  }): Promise<AutomationVisionLocateOutput> {
    try {
      return await this.locateWithVisionModel({
        aiImage,
        context,
        deadline,
        input,
        model,
        provider,
      });
    } catch (error) {
      return {
        matches: [],
        query: input.query,
        threshold: input.threshold,
        reason: sanitizeAiText(
          error instanceof Error ? error.message : String(error),
          600,
        ),
      };
    }
  }

  private async locateWithVisionModel({
    aiImage,
    context,
    deadline,
    input,
    model,
    provider,
  }: {
    aiImage: NonNullable<AutomationScreenObservation['aiImage']>;
    context: Pick<AutomationCommandContext, 'abortSignal'>;
    deadline?: number;
    input: AutomationVisionLocateInput;
    provider: AutomationAiProvider;
    model: AutomationAiProviderModel;
  }): Promise<AutomationVisionLocateOutput> {
    const controller = new AbortController();
    const timeoutMs = deadline
      ? Math.max(1, Math.min(30_000, deadline - Date.now()))
      : 30_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    context.abortSignal?.addEventListener('abort', onAbort, { once: true });

    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: [
            'You locate visible Android UI targets for automation.',
            'Return JSON only. Do not request tools.',
            'Use normalized 0..1 bounds. If the requested target is not visible, return no matches and explain why.',
            model.settings.systemPrompt,
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
                `Find visible target: ${input.query}`,
                `Return at most ${input.maxResults} match(es) with confidence >= ${input.threshold}.`,
                'JSON shape: {"matches":[{"label":"...","description":"...","confidence":0.0,"bounds":{"left":0,"top":0,"width":0,"height":0}}],"reason":"..."}',
              ].join('\n'),
            },
            { type: 'image_url', image_url: { url: aiImage.dataUrl } },
          ],
        },
      ];
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
          buildChatRequestBody({
            provider,
            model,
            messages,
            stream: false,
          }),
        ),
      });
      if (!response.ok) {
        const detail = providerErrorDetailFromText(
          await response.text().catch(() => ''),
        );
        throw new BadRequestException(
          `Vision locate request failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`,
        );
      }
      const body = (await response.json().catch(() => null)) as {
        choices?: Array<{ message?: ChatMessage }>;
      } | null;
      const content = body?.choices?.[0]?.message?.content;
      const text =
        typeof content === 'string'
          ? content
          : Array.isArray(content)
            ? content
                .filter((part) => part.type === 'text')
                .map((part) => part.text)
                .join('\n')
            : '';
      const parsed = parseVisionLocateResponse(text);
      const matches = parsed.matches
        .filter((match) => match.confidence >= input.threshold)
        .slice(0, input.maxResults)
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
        query: input.query,
        threshold: input.threshold,
        ...(matches.length === 0 || parsed.reason
          ? { reason: parsed.reason || 'Vision model found no visible match.' }
          : {}),
      };
    } finally {
      context.abortSignal?.removeEventListener('abort', onAbort);
      clearTimeout(timeout);
    }
  }

  summarizeForPlanner(observation: AutomationScreenObservation) {
    const visionState = observation.summary
      ? `Vision model summary: available.`
      : observation.visionSummaryError
        ? `Vision summary failed: ${observation.visionSummaryError}`
        : 'Vision model summary: unavailable; planner cannot inspect screenshot pixels directly and must rely on UI hierarchy detections/text.';
    const visibilityWarning =
      !observation.summary && observation.detections.length === 0
        ? 'Visibility warning: no UI hierarchy detections and no vision summary are available. The planner should ask the user for more context, use non-visual Android state-reading tools, or request a configured vision model instead of guessing screen contents.'
        : '';
    const lines = [
      `Screen observation: ${observation.image.width}x${observation.image.height}, captured ${observation.image.capturedAt}.`,
      observation.uiXml
        ? `UI hierarchy: ${observation.uiXml.status}, ${observation.uiXml.nodeCount} node(s), ${observation.uiXml.bytes} byte(s), truncated=${observation.uiXml.truncated}${observation.uiXml.error ? `, error=${observation.uiXml.error}` : ''}.`
        : 'UI hierarchy: unavailable.',
      visionState,
      visibilityWarning,
      observation.summary ? `Vision summary: ${observation.summary}` : '',
      'UI hierarchy detections use normalized bounds and centers in 0..1 screen coordinates:',
      ...observation.detections.slice(0, 40).map((detection, index) =>
        JSON.stringify({
          n: index + 1,
          label: detection.label,
          text: detection.text,
          role: detection.role,
          description: detection.description,
          confidence: detection.confidence,
          bounds: detection.bounds,
          center: detection.center,
          source: detection.source,
        }),
      ),
    ].filter(Boolean);
    return lines.join('\n');
  }

  private async describeWithVisionModel({
    aiImage,
    context,
    deadline,
    model,
    provider,
  }: {
    aiImage: NonNullable<AutomationScreenObservation['aiImage']>;
    context: Pick<AutomationCommandContext, 'abortSignal'>;
    deadline?: number;
    model: AutomationAiProviderModel;
    provider: AutomationAiProvider;
  }) {
    const controller = new AbortController();
    const timeoutMs = deadline
      ? Math.max(1, Math.min(30_000, deadline - Date.now()))
      : 30_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    context.abortSignal?.addEventListener('abort', onAbort, { once: true });

    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: [
            'You are a visual screen description model for Android automation.',
            'Describe visible UI elements, text, app state, and likely tappable targets.',
            'Return concise factual text only. Do not request tools.',
            model.settings.systemPrompt,
          ]
            .filter(Boolean)
            .join('\n'),
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Describe this Android screen for a separate automation planner. Use normalized positions when useful.',
            },
            { type: 'image_url', image_url: { url: aiImage.dataUrl } },
          ],
        },
      ];
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
          buildChatRequestBody({
            provider,
            model,
            messages,
            stream: false,
          }),
        ),
      });
      if (!response.ok) {
        const detail = providerErrorDetailFromText(
          await response.text().catch(() => ''),
        );
        throw new BadRequestException(
          `Vision provider request failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`,
        );
      }
      const body = (await response.json().catch(() => null)) as {
        choices?: Array<{ message?: ChatMessage }>;
      } | null;
      const content = body?.choices?.[0]?.message?.content;
      const text =
        typeof content === 'string'
          ? content
          : Array.isArray(content)
            ? content
                .filter((part) => part.type === 'text')
                .map((part) => part.text)
                .join('\n')
            : '';
      return sanitizeAiText(text, 4_000);
    } finally {
      context.abortSignal?.removeEventListener('abort', onAbort);
      clearTimeout(timeout);
    }
  }

  private assertNotCanceled(abortSignal?: AbortSignal) {
    if (abortSignal?.aborted) {
      throw new BadRequestException(
        'Automation vision operation was canceled.',
      );
    }
  }
}

type VisionLocateModelMatch = {
  label?: string;
  description?: string;
  confidence: number;
  bounds: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};

const parseVisionLocateResponse = (
  text: string,
): { matches: VisionLocateModelMatch[]; reason?: string } => {
  const parsed = parseJsonObject(extractJsonObject(text));
  const record =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  const matches = Array.isArray(record.matches) ? record.matches : [];
  return {
    matches: matches.flatMap((match) => {
      if (!match || typeof match !== 'object') return [];
      const item = match as Record<string, unknown>;
      const bounds =
        item.bounds && typeof item.bounds === 'object'
          ? (item.bounds as Record<string, unknown>)
          : null;
      const left = Number(bounds?.left);
      const top = Number(bounds?.top);
      const width = Number(bounds?.width);
      const height = Number(bounds?.height);
      const confidence = Number(item.confidence);
      if (
        ![left, top, width, height, confidence].every(Number.isFinite) ||
        width <= 0 ||
        height <= 0
      ) {
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
          confidence,
          bounds: { left, top, width, height },
        },
      ];
    }),
    ...(typeof record.reason === 'string'
      ? { reason: sanitizeAiText(record.reason, 500) }
      : {}),
  };
};

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
