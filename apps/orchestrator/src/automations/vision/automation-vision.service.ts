import { BadRequestException, Injectable } from '@nestjs/common';
import {
  pointWithinBox,
  type NormalizedBox,
} from '@rebroid/vision-core/geometry';
import {
  createDetection,
  matchesDetectionQuery,
  sortDetections,
  type VisionDetection,
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

const BOUNDS_PATTERN = /\[(\d+),(\d+)]\[(\d+),(\d+)]/;
const XML_NODE_PATTERN = /<node\b[^>]*>/g;
const XML_ATTRIBUTE_PATTERN = /([\w:-]+)="([^"]*)"/g;

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
    const summary = visionModel
      ? await this.describeWithVisionModel({
          aiImage,
          context,
          deadline,
          ...visionModel,
        })
      : undefined;

    return {
      image,
      aiImage,
      detections: sortDetections(detections).slice(0, 80),
      ...(summary ? { summary } : {}),
      uiXml,
    };
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
    const observation = await this.observe(context, visionModel, deadline);
    const region = input.region;
    const matches = sortDetections(
      observation.detections.filter((detection) => {
        if (detection.confidence < input.threshold) return false;
        if (!matchesDetectionQuery(detection, input.query)) return false;
        return region ? pointWithinBox(detection.center, region) : true;
      }),
    ).slice(0, input.maxResults);

    return {
      matches,
      query: input.query,
      threshold: input.threshold,
    };
  }

  summarizeForPlanner(observation: AutomationScreenObservation) {
    const lines = [
      `Screen observation: ${observation.image.width}x${observation.image.height}, captured ${observation.image.capturedAt}.`,
      observation.uiXml
        ? `UI hierarchy: ${observation.uiXml.status}, ${observation.uiXml.nodeCount} node(s), ${observation.uiXml.bytes} byte(s), truncated=${observation.uiXml.truncated}${observation.uiXml.error ? `, error=${observation.uiXml.error}` : ''}.`
        : 'UI hierarchy: unavailable.',
      observation.summary ? `Vision summary: ${observation.summary}` : '',
      'Detected elements use normalized bounds and centers in 0..1 screen coordinates:',
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

const extractUiDetections = (
  xml: string,
  image: { width: number; height: number },
): VisionDetection[] => {
  const detections: VisionDetection[] = [];
  for (const match of xml.matchAll(XML_NODE_PATTERN)) {
    const attributes = attributesOf(match[0]);
    const bounds = boundsOf(attributes.bounds, image);
    if (!bounds) continue;
    const text = cleanAttribute(attributes.text);
    const description = cleanAttribute(attributes['content-desc']);
    const resourceId = cleanAttribute(attributes['resource-id']);
    const className = cleanAttribute(attributes.class);
    const label = text || description || resourceId || className;
    if (!label) continue;
    detections.push(
      createDetection({
        id: `ui-${detections.length + 1}`,
        label,
        ...(text ? { text } : {}),
        ...(description ? { description } : {}),
        ...(className ? { role: className.split('.').pop() ?? className } : {}),
        confidence: text || description ? 0.92 : 0.72,
        bounds,
        source: 'ui-xml',
      }),
    );
  }
  return detections;
};

const attributesOf = (node: string) => {
  const attributes: Record<string, string> = {};
  for (const match of node.matchAll(XML_ATTRIBUTE_PATTERN)) {
    attributes[match[1]] = decodeXml(match[2]);
  }
  return attributes;
};

const cleanAttribute = (value: string | undefined) => {
  const next = value?.trim();
  return next && next !== 'false' && next !== 'true' ? next : '';
};

const boundsOf = (
  value: string | undefined,
  image: { width: number; height: number },
): NormalizedBox | null => {
  const match = value?.match(BOUNDS_PATTERN);
  if (!match) return null;
  const left = Number(match[1]);
  const top = Number(match[2]);
  const right = Number(match[3]);
  const bottom = Number(match[4]);
  if (![left, top, right, bottom].every(Number.isFinite)) return null;
  const width = Math.max(1, image.width);
  const height = Math.max(1, image.height);
  return {
    left: left / width,
    top: top / height,
    width: Math.max(0, right - left) / width,
    height: Math.max(0, bottom - top) / height,
  };
};

const decodeXml = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
