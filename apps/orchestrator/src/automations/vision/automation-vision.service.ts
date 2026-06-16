import { BadRequestException, Injectable } from '@nestjs/common';
import { pointWithinBox } from '@rebroid/vision-core/geometry';
import {
  createDetection,
  extractUiDetections,
  matchesDetectionQuery,
  sortDetections,
} from '@rebroid/vision-core/observation';
import type { VisionDetection } from '@rebroid/vision-core/observation';
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
} from '@rebroid/ai-core/provider';
import {
  buildChatRequestBody,
  chatCompletionsEndpoint,
  correctScreenStateHypothesis,
  rankObservationCandidates,
  reconcileScreenStateHypothesis,
  summarizeObservationCandidates,
  type ChatMessage,
  type AiObservationCandidate,
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
  AutomationVisionContext,
  AutomationVisionScreenState,
  AutomationVisionLocateInput,
  AutomationVisionLocateOutput,
} from './automation-vision.types';
import { AutomationOcrService } from './automation-ocr.service';

@Injectable()
export class AutomationVisionService {
  constructor(private readonly ocr: AutomationOcrService) {}

  async observe(
    context: Pick<AutomationCommandContext, 'adb' | 'app' | 'abortSignal'>,
    visionModel?: {
      provider: AutomationAiProvider;
      model: AutomationAiProviderModel;
    },
    deadline?: number,
    visionContext?: AutomationVisionContext,
  ): Promise<AutomationScreenObservation> {
    this.assertNotCanceled(context.abortSignal);
    const screenshot = await context.adb.screenshot(context.app);
    const aiImage = await optimizeAiScreenshot(screenshot);
    const uiPromise = context.adb
      .dumpUi(context.app)
      .catch((error: unknown) => ({
        status: 'failed' as const,
        error:
          error instanceof Error ? error.message : 'UI hierarchy dump failed.',
      }));
    const ocrPromise = this.ocr.recognize(aiImage, context.abortSignal);
    const describedPromise: Promise<{
      screenState?: AutomationVisionScreenState;
      summary?: string;
      visionSummaryError?: string;
    }> = visionModel
      ? this.describeWithVisionModelSafe({
          aiImage,
          context,
          deadline,
          visionContext,
          ...visionModel,
        })
      : Promise.resolve({
          summary: undefined,
          visionSummaryError: undefined,
        });
    const [ui, ocr, described] = await Promise.all([
      uiPromise,
      ocrPromise,
      describedPromise,
    ]);
    const image = {
      width: aiImage.width ?? 1,
      height: aiImage.height ?? 1,
      mimeType: screenshot.mimeType,
      capturedAt: screenshot.capturedAt,
      source: 'screenshot' as const,
    };
    const uiDumpAvailable = ui.status === 'available' && Boolean(ui.xml);
    const uiDiagnostics = 'diagnostics' in ui ? ui.diagnostics : undefined;
    const uiError = 'error' in ui ? ui.error : undefined;
    const preparedUi = uiDumpAvailable && ui.xml ? prepareUiXml(ui.xml) : null;
    const detections = preparedUi
      ? extractUiDetections(preparedUi.xml, image)
      : [];
    const uiXml = preparedUi
      ? {
          bytes: Buffer.byteLength(preparedUi.xml),
          detectionCount: detections.length,
          diagnostics: uiDiagnostics,
          nodeCount: preparedUi.nodeCount,
          rawNodeCount: uiDiagnostics?.rawNodeCount ?? preparedUi.nodeCount,
          status:
            preparedUi.nodeCount > 0
              ? ('available' as const)
              : ('empty' as const),
          truncated: preparedUi.truncated,
        }
      : {
          bytes: 0,
          detectionCount: 0,
          diagnostics: uiDiagnostics,
          error: uiError,
          nodeCount: 0,
          rawNodeCount: uiDiagnostics?.rawNodeCount ?? 0,
          status: 'failed' as const,
          truncated: false,
        };
    const candidates = rankObservationCandidates({
      candidates: this.buildObservationCandidates(
        detections,
        described.screenState?.controls ?? [],
        ocr.detections,
      ),
      goal: visionContext?.goal,
      maxCandidates: 30,
    });
    const reconciliation = described.screenState
      ? reconcileScreenStateHypothesis({
          state: described.screenState,
          candidates,
          confirmedFacts: visionContext?.confirmedFacts ?? [],
        })
      : null;
    const screenState =
      described.screenState && reconciliation
        ? {
            ...described.screenState,
            screenKind: reconciliation.screenKind,
            confidence: reconciliation.confidence,
            settingsAccessVisible: reconciliation.settingsAccessVisible,
            rawScreenKind:
              described.screenState.rawScreenKind ??
              reconciliation.rawScreenKind,
            ...(reconciliation.correctionReason
              ? { correctionReason: reconciliation.correctionReason }
              : {}),
            ...(reconciliation.contradictionReason
              ? {
                  uncertainty: [
                    reconciliation.contradictionReason,
                    ...described.screenState.uncertainty,
                  ].slice(0, 12),
                }
              : {}),
          }
        : undefined;
    const summary = screenState?.summary ?? described.summary;

    return {
      image,
      aiImage,
      detections: sortDetections(detections).slice(0, 80),
      ...(summary ? { summary } : {}),
      ...(screenState ? { screenState } : {}),
      ...(described.visionSummaryError
        ? { visionSummaryError: described.visionSummaryError }
        : {}),
      ocr,
      candidates,
      markedScreenshotId: `som-${image.capturedAt}`,
      ...(reconciliation
        ? {
            reconciliation: {
              rawScreenKind: reconciliation.rawScreenKind,
              rawConfidence: reconciliation.rawConfidence,
              visionReliable: reconciliation.visionReliable,
              ...(reconciliation.contradictionReason
                ? { contradictionReason: reconciliation.contradictionReason }
                : {}),
            },
          }
        : {}),
      uiXml,
    };
  }

  private buildObservationCandidates(
    detections: VisionDetection[],
    controls: AutomationVisionScreenState['controls'],
    ocrDetections: VisionDetection[] = [],
  ): AiObservationCandidate[] {
    const uiCandidates = sortDetections(detections).map((detection, index) => ({
      id: `ui-${index + 1}`,
      label:
        detection.label ??
        detection.text ??
        detection.description ??
        `UI element ${index + 1}`,
      source: 'ui-xml' as const,
      ...(detection.role ? { role: detection.role } : {}),
      confidence: detection.confidence,
      evidence: [
        detection.text ? `text=${detection.text}` : '',
        detection.description ? `description=${detection.description}` : '',
      ].filter(Boolean),
      bounds: detection.bounds,
    }));
    const visionCandidates = controls.map((control, index) => ({
      id: `vision-${index + 1}`,
      label: control.label,
      source: 'vision-model' as const,
      ...(control.role ? { role: control.role } : {}),
      confidence: control.confidence ?? 0.5,
      ...(control.evidence ? { evidence: control.evidence } : {}),
      ...(control.bounds ? { bounds: control.bounds } : {}),
    }));
    const ocrCandidates = sortDetections(ocrDetections).map(
      (detection, index) => ({
        id: `ocr-${index + 1}`,
        label:
          detection.label ??
          detection.text ??
          detection.description ??
          `OCR text ${index + 1}`,
        source: 'ocr' as const,
        confidence: detection.confidence,
        evidence: [
          detection.text ? `text=${detection.text}` : '',
          detection.description ? `description=${detection.description}` : '',
        ].filter(Boolean),
        bounds: detection.bounds,
      }),
    );
    return [...uiCandidates, ...ocrCandidates, ...visionCandidates];
  }

  private async describeWithVisionModelSafe({
    aiImage,
    context,
    deadline,
    model,
    provider,
    visionContext,
  }: {
    aiImage: NonNullable<AutomationScreenObservation['aiImage']>;
    context: Pick<AutomationCommandContext, 'abortSignal'>;
    deadline?: number;
    provider: AutomationAiProvider;
    model: AutomationAiProviderModel;
    visionContext?: AutomationVisionContext;
  }): Promise<{
    screenState?: AutomationVisionScreenState;
    summary?: string;
    visionSummaryError?: string;
  }> {
    try {
      const screenState = await this.describeWithVisionModel({
        aiImage,
        context,
        deadline,
        model,
        provider,
        visionContext,
      });
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
      ? `Vision hypothesis: available${observation.screenState ? `, screenKind=${observation.screenState.screenKind}, confidence=${observation.screenState.confidence}` : ''}.`
      : observation.visionSummaryError
        ? `Vision summary failed: ${observation.visionSummaryError}`
        : 'Vision model summary: unavailable; planner cannot inspect screenshot pixels directly and must rely on UI hierarchy detections/text.';
    const visibilityWarning =
      !observation.summary && observation.detections.length === 0
        ? 'Visibility warning: no UI hierarchy detections and no vision summary are available. The planner should ask the user for more context, use non-visual Android state-reading tools, or request a configured vision model instead of guessing screen contents.'
        : '';
    const ocrState = observation.ocr
      ? `OCR: ${observation.ocr.status}, ${observation.ocr.detections.length} text box(es)${observation.ocr.preprocessingMode ? `, preprocessing=${observation.ocr.preprocessingMode}` : ''}${observation.ocr.elapsedMs !== undefined ? `, elapsedMs=${observation.ocr.elapsedMs}` : ''}${observation.ocr.error ? `, error=${observation.ocr.error}` : ''}.`
      : 'OCR: unavailable.';
    const lines = [
      `Screen observation: ${observation.image.width}x${observation.image.height}, captured ${observation.image.capturedAt}.`,
      observation.uiXml
        ? `UI hierarchy: ${observation.uiXml.status}, ${observation.uiXml.nodeCount} node(s), ${observation.uiXml.detectionCount ?? observation.detections.length} labeled detection(s), ${observation.uiXml.bytes} byte(s), truncated=${observation.uiXml.truncated}${observation.uiXml.rawNodeCount !== undefined ? `, rawNodeCount=${observation.uiXml.rawNodeCount}` : ''}${observation.uiXml.error ? `, error=${observation.uiXml.error}` : ''}.`
        : 'UI hierarchy: unavailable.',
      ocrState,
      'Grounding precedence: confirmed Android facts > UI XML > OCR text > visual hypothesis.',
      visionState,
      visibilityWarning,
      observation.screenState
        ? `Vision hypothesis details: ${JSON.stringify({
            screenKind: observation.screenState.screenKind,
            rawScreenKind: observation.screenState.rawScreenKind ?? null,
            correctionReason: observation.screenState.correctionReason ?? null,
            reconciliation: observation.reconciliation ?? null,
            settingsAccessVisible:
              observation.screenState.settingsAccessVisible ?? null,
            confidence: observation.screenState.confidence,
            visibleText: observation.screenState.visibleText,
            controls: observation.screenState.controls,
            evidence: observation.screenState.evidence,
            uncertainty: observation.screenState.uncertainty,
            summary: observation.screenState.summary,
          })}`
        : observation.summary
          ? `Vision hypothesis summary: ${observation.summary}`
          : '',
      observation.reconciliation?.contradictionReason
        ? `Vision contradiction: ${observation.reconciliation.contradictionReason}`
        : '',
      summarizeObservationCandidates({
        candidates: observation.candidates,
        maxCandidates: 12,
      }),
      'Confirmed tool facts: none yet in this observation. Later tool results override conflicting vision hypotheses unless a newer observation proves otherwise.',
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
      observation.ocr?.detections.length
        ? 'OCR detections use normalized bounds and centers in 0..1 screen coordinates:'
        : '',
      ...(observation.ocr?.detections.slice(0, 30).map((detection, index) =>
        JSON.stringify({
          n: index + 1,
          label: detection.label,
          text: detection.text,
          confidence: detection.confidence,
          bounds: detection.bounds,
          center: detection.center,
          source: detection.source,
        }),
      ) ?? []),
    ].filter(Boolean);
    return lines.join('\n');
  }

  private async describeWithVisionModel({
    aiImage,
    context,
    deadline,
    model,
    provider,
    visionContext,
  }: {
    aiImage: NonNullable<AutomationScreenObservation['aiImage']>;
    context: Pick<AutomationCommandContext, 'abortSignal'>;
    deadline?: number;
    model: AutomationAiProviderModel;
    provider: AutomationAiProvider;
    visionContext?: AutomationVisionContext;
  }): Promise<AutomationVisionScreenState> {
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
            'Return JSON only. Do not request tools.',
            'Treat app/screen identity as uncertain unless visible text, title, or distinctive controls support it.',
            'Inspect icons and contextual clues, including gear/settings icons, but report them as candidate controls unless app identity is confirmed.',
            'List icon-only controls when they are visually important. Use cautious labels such as "settings access gear candidate" with confidence and evidence.',
            'A quick-settings shade with brightness slider, Internet/Bluetooth tiles, power button, edit pencil, or status-shade layout is quick_settings, not settings_app. A gear icon there means settings access is visible, not that Settings is open.',
            'An app drawer shows an app grid/list, app search, "All apps", or installed app icons/labels. Classify that as app_drawer, not home.',
            'Use screenKind values: home, app_drawer, quick_settings, notification_shade, settings_app, app_screen, unknown.',
            'Use normalized 0..1 bounds for controls only when visually clear.',
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
                'Describe this Android screen for a separate automation planner.',
                visionContext
                  ? `Task context: ${JSON.stringify({
                      goal: visionContext.goal ?? null,
                      lastAction: visionContext.lastAction ?? null,
                      expectedOutcome: visionContext.expectedOutcome ?? null,
                      confirmedFacts: (
                        visionContext.confirmedFacts ?? []
                      ).slice(-8),
                      latestHypothesis: visionContext.latestHypothesis ?? null,
                    })}`
                  : '',
                'JSON shape: {"screenKind":"home|app_drawer|quick_settings|notification_shade|settings_app|app_screen|unknown","confidence":0.0,"visibleText":["..."],"controls":[{"label":"...","role":"button|icon|text|field|tile|unknown","bounds":{"left":0,"top":0,"width":0,"height":0},"confidence":0.0,"evidence":["..."]}],"evidence":["..."],"uncertainty":["..."],"summary":"one concise factual sentence"}.',
                'If the screen could be multiple things, choose unknown or low confidence and explain uncertainty.',
              ]
                .filter(Boolean)
                .join('\n'),
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
      return parseVisionScreenStateResponse(text);
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
  const confidence = clamp01(Number(record.confidence));
  const rawControls = Array.isArray(record.controls) ? record.controls : [];
  const rawScreenKind = screenKinds.has(requestedKind)
    ? (requestedKind as AutomationVisionScreenState['screenKind'])
    : 'unknown';
  const rawSummary =
    typeof record.summary === 'string'
      ? sanitizeAiText(record.summary, 800)
      : sanitizeAiText(text, 800);
  const baseState: AutomationVisionScreenState = {
    screenKind: rawScreenKind,
    confidence,
    visibleText: stringArray(record.visibleText, 30, 120),
    controls: rawControls.flatMap((control) => normalizeVisionControl(control)),
    evidence: stringArray(record.evidence, 12, 180),
    uncertainty: stringArray(record.uncertainty, 12, 180),
    summary: rawSummary,
  };
  const correction = correctScreenStateHypothesis(baseState);
  const controls = withSettingsAccessControl(
    baseState.controls,
    correction.settingsAccessVisible,
  );
  return {
    ...baseState,
    controls,
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
  const left = Number(bounds?.left);
  const top = Number(bounds?.top);
  const width = Number(bounds?.width);
  const height = Number(bounds?.height);
  const normalizedBounds =
    [left, top, width, height].every(Number.isFinite) &&
    left >= 0 &&
    top >= 0 &&
    width > 0 &&
    height > 0
      ? { left, top, width, height }
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

const stringArray = (value: unknown, maxItems: number, maxLength: number) =>
  (Array.isArray(value) ? value : [])
    .filter((item): item is string => typeof item === 'string')
    .slice(0, maxItems)
    .map((item) => sanitizeAiText(item, maxLength));

const clamp01 = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

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
