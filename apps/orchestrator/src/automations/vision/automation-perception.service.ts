import { Injectable } from '@nestjs/common';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationAiProviderService } from '../ai/automation-ai-provider.service';
import type { AutomationAiHarnessContext } from '../ai/automation-ai.types';
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
  }: {
    context: AutomationAiHarnessContext;
    input: { visionProviderId?: string; visionModelId?: string };
    deadline?: number;
    reason: string;
    uses?: string;
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
    );
    await this.events.emit({
      runId: context.runId,
      ownerUserId: context.ownerUserId,
      type: 'ai.perception.observed',
      stepId: context.stepId,
      parentStepId: context.parentStepId ?? null,
      message: `Screen observed: ${observation.detections.length} element(s) detected.`,
      data: {
        clientMessageId: context.clientMessageId ?? null,
        reason,
        uses: uses ?? null,
        width: observation.image.width,
        height: observation.image.height,
        capturedAt: observation.image.capturedAt,
        detections: observation.detections.length,
        uiNodes: observation.uiXml?.nodeCount ?? null,
        hasVisionSummary: Boolean(observation.summary),
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
        },
      });
    }
    return {
      observation,
      plannerText: this.vision.summarizeForPlanner(observation),
    };
  }
}
