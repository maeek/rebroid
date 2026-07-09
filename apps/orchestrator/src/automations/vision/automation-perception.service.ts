import { Injectable } from '@nestjs/common';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { AutomationAiProviderService } from '../ai/automation-ai-provider.service';
import type { AutomationAiHarnessContext } from '../ai/automation-ai.types';
import type { AutomationVisionContext } from './automation-vision.types';
import { AutomationVisionService } from './automation-vision.service';
import {
  perceptionEventData,
  perceptionObservationMessage,
  perceptionSummaryData,
} from './automation-perception-events';

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
      message: perceptionObservationMessage(observation),
      data: perceptionEventData(observation, {
        clientMessageId: context.clientMessageId,
        reason,
        uses,
        goal: visionContext?.goal,
      }),
    });
    if (observation.summary) {
      await this.events.emit({
        runId: context.runId,
        ownerUserId: context.ownerUserId,
        type: 'ai.perception.summary',
        stepId: context.stepId,
        parentStepId: context.parentStepId ?? null,
        message: 'Vision summary received.',
        data: perceptionSummaryData(observation, {
          clientMessageId: context.clientMessageId,
          reason,
          uses,
          goal: visionContext?.goal,
        }),
      });
    }
    return {
      observation,
      plannerText: this.vision.summarizeForPlanner(observation),
    };
  }
}
