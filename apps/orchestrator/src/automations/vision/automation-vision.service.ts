import { BadRequestException, Injectable } from '@nestjs/common';
import { pointWithinBox } from '@rebroid/vision-core/geometry';
import {
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
    const visionState = observation.summary
      ? `Vision model summary: available.`
      : observation.visionSummaryError
        ? `Vision summary failed: ${observation.visionSummaryError}`
        : 'Vision model summary: unavailable; planner cannot inspect screenshot pixels directly and must rely on UI XML detections/text.';
    const visibilityWarning =
      !observation.summary && observation.detections.length === 0
        ? 'Visibility warning: no UI XML detections and no vision summary are available. The planner should ask the user for more context or use non-visual state-reading tools instead of guessing screen contents.'
        : '';
    const lines = [
      `Screen observation: ${observation.image.width}x${observation.image.height}, captured ${observation.image.capturedAt}.`,
      observation.uiXml
        ? `UI hierarchy: ${observation.uiXml.status}, ${observation.uiXml.nodeCount} node(s), ${observation.uiXml.bytes} byte(s), truncated=${observation.uiXml.truncated}${observation.uiXml.error ? `, error=${observation.uiXml.error}` : ''}.`
        : 'UI hierarchy: unavailable.',
      visionState,
      visibilityWarning,
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
