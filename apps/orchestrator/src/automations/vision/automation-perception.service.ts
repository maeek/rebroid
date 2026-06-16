import { Injectable } from '@nestjs/common';
import { summarizeVisualAffordances } from '@rebroid/ai-core/harness';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationAiProviderService } from '../ai/automation-ai-provider.service';
import type { AutomationAiHarnessContext } from '../ai/automation-ai.types';
import type { AutomationVisionContext } from './automation-vision.types';
import { AutomationVisionService } from './automation-vision.service';

@Injectable()
export class AutomationPerceptionService {
  constructor(
    private readonly aiProviders: AutomationAiProviderService,
    private readonly events: AutomationRunEventBus,
    private readonly vision: AutomationVisionService,
  ) {}

  async observe({
    context,
    input,
    deadline,
    reason,
    uses,
    visionContext,
  }: {
    context: AutomationAiHarnessContext;
    input: { visionProviderId?: string; visionModelId?: string };
    deadline?: number;
    reason: string;
    uses?: string;
    visionContext?: AutomationVisionContext;
  }) {
    const visionModel =
      input.visionProviderId || input.visionModelId
        ? await this.aiProviders.getProvider(
            input.visionProviderId,
            input.visionModelId,
            'vision',
          )
        : undefined;
    const observation = await this.vision.observe(
      context,
      visionModel,
      deadline,
      visionContext,
    );
    await this.events.emit({
      runId: context.runId,
      ownerUserId: context.ownerUserId,
      type: 'ai.perception.observed',
      stepId: context.stepId,
      parentStepId: context.parentStepId ?? null,
      message: this.observationMessage(observation),
      data: {
        clientMessageId: context.clientMessageId ?? null,
        reason,
        uses: uses ?? null,
        width: observation.image.width,
        height: observation.image.height,
        capturedAt: observation.image.capturedAt,
        detections: observation.detections.length,
        uiNodes: observation.uiXml?.nodeCount ?? null,
        uiDetectionCount:
          observation.uiXml?.detectionCount ?? observation.detections.length,
        uiRawNodeCount: observation.uiXml?.rawNodeCount ?? null,
        uiStatus: observation.uiXml?.status ?? 'unavailable',
        uiError: observation.uiXml?.error ?? null,
        uiBytes: observation.uiXml?.bytes ?? null,
        uiDiagnostics: observation.uiXml?.diagnostics ?? null,
        ocrStatus: observation.ocr?.status ?? 'unavailable',
        ocrTextCount: observation.ocr?.detections.length ?? 0,
        ocrElapsedMs: observation.ocr?.elapsedMs ?? null,
        ocrEngine: observation.ocr?.engine ?? null,
        ocrModel: observation.ocr?.model ?? null,
        ocrLanguages: observation.ocr?.languages ?? [],
        ocrError: observation.ocr?.error ?? null,
        ocrDetections: observation.ocr?.detections.slice(0, 30) ?? [],
        hasVisionSummary: Boolean(observation.summary),
        screenKind: observation.screenState?.screenKind ?? null,
        rawScreenKind: observation.screenState?.rawScreenKind ?? null,
        screenKindCorrectionReason:
          observation.screenState?.correctionReason ?? null,
        settingsAccessVisible:
          observation.screenState?.settingsAccessVisible ?? null,
        visionConfidence: observation.screenState?.confidence ?? null,
        visibleText: observation.screenState?.visibleText.slice(0, 20) ?? [],
        controls: observation.screenState?.controls.slice(0, 20) ?? [],
        candidates: observation.candidates.slice(0, 20),
        markedScreenshotId: observation.markedScreenshotId,
        reconciliation: observation.reconciliation ?? null,
        visualAffordances: summarizeVisualAffordances({
          state: observation.screenState ?? null,
          goal: visionContext?.goal,
        }),
        visionEvidence: observation.screenState?.evidence ?? [],
        visionUncertainty: observation.screenState?.uncertainty ?? [],
      },
    });
    if (observation.summary) {
      await this.events.emit({
        runId: context.runId,
        ownerUserId: context.ownerUserId,
        type: 'ai.perception.summary',
        stepId: context.stepId,
        parentStepId: context.parentStepId ?? null,
        message: 'Vision summary received.',
        data: {
          clientMessageId: context.clientMessageId ?? null,
          reason,
          uses: uses ?? null,
          screenKind: observation.screenState?.screenKind ?? null,
          rawScreenKind: observation.screenState?.rawScreenKind ?? null,
          screenKindCorrectionReason:
            observation.screenState?.correctionReason ?? null,
          settingsAccessVisible:
            observation.screenState?.settingsAccessVisible ?? null,
          visionConfidence: observation.screenState?.confidence ?? null,
          visibleText: observation.screenState?.visibleText.slice(0, 20) ?? [],
          controls: observation.screenState?.controls.slice(0, 20) ?? [],
          candidates: observation.candidates.slice(0, 20),
          markedScreenshotId: observation.markedScreenshotId,
          reconciliation: observation.reconciliation ?? null,
          visualAffordances: summarizeVisualAffordances({
            state: observation.screenState ?? null,
            goal: visionContext?.goal,
          }),
          evidence: observation.screenState?.evidence ?? [],
          uncertainty: observation.screenState?.uncertainty ?? [],
          ocrStatus: observation.ocr?.status ?? 'unavailable',
          ocrTextCount: observation.ocr?.detections.length ?? 0,
          ocrDetections: observation.ocr?.detections.slice(0, 30) ?? [],
        },
      });
    }
    return {
      observation,
      plannerText: this.vision.summarizeForPlanner(observation),
    };
  }

  private observationMessage(
    observation: Awaited<ReturnType<AutomationVisionService['observe']>>,
  ) {
    const uiStatus = observation.uiXml?.status ?? 'unavailable';
    const uiDetail =
      uiStatus === 'available'
        ? `${observation.uiXml?.nodeCount ?? 0} UI node(s), ${observation.uiXml?.detectionCount ?? observation.detections.length} labeled`
        : uiStatus;
    const ocr =
      observation.ocr && observation.ocr.status !== 'disabled'
        ? ` OCR ${observation.ocr.status}, ${observation.ocr.detections.length} text box(es).`
        : '';
    return `Screen captured: UI hierarchy ${uiDetail}.${ocr}`;
  }
}
