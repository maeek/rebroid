import { Injectable } from '@nestjs/common';
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
      message: `Screen captured: ${observation.detections.length} UI hierarchy element(s) detected.`,
      data: {
        clientMessageId: context.clientMessageId ?? null,
        reason,
        uses: uses ?? null,
        width: observation.image.width,
        height: observation.image.height,
        capturedAt: observation.image.capturedAt,
        detections: observation.detections.length,
        uiNodes: observation.uiXml?.nodeCount ?? null,
        uiStatus: observation.uiXml?.status ?? 'unavailable',
        hasVisionSummary: Boolean(observation.summary),
        screenKind: observation.screenState?.screenKind ?? null,
        rawScreenKind: observation.screenState?.rawScreenKind ?? null,
        screenKindCorrectionReason:
          observation.screenState?.correctionReason ?? null,
        settingsAccessVisible:
          observation.screenState?.settingsAccessVisible ?? null,
        visionConfidence: observation.screenState?.confidence ?? null,
        visibleText: observation.screenState?.visibleText.slice(0, 20) ?? [],
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
          evidence: observation.screenState?.evidence ?? [],
          uncertainty: observation.screenState?.uncertainty ?? [],
        },
      });
    }
    return {
      observation,
      plannerText: this.vision.summarizeForPlanner(observation),
    };
  }
}
