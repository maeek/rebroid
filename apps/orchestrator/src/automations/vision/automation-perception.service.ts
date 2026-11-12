import { Injectable } from '@nestjs/common';
import type { AutomationAiRunInput } from '../../settings/contracts/ai-provider';
import { AutomationRunEventBus } from '../events/automation-run-event-bus.service';
import { emitAutomationAiEvent } from '../ai/automation-ai-events';
import { AutomationAiProviderService } from '../ai/automation-ai-provider.service';
import type { AutomationAiHarnessContext } from '../ai/automation-ai.types';
import type { AutomationObservedScreen } from './automation-vision.types';
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
  }: {
    context: AutomationAiHarnessContext;
    input: Pick<
      AutomationAiRunInput,
      'prompt' | 'clientMessageId' | 'visionProviderId' | 'visionModelId'
    >;
    deadline: number;
    reason: string;
    uses?: string;
  }): Promise<AutomationObservedScreen> {
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
      { goal: input.prompt },
    );
    const details = {
      clientMessageId: input.clientMessageId ?? null,
      reason,
      uses,
      goal: input.prompt,
    };
    await emitAutomationAiEvent(
      this.events,
      context,
      'ai.perception.observed',
      perceptionObservationMessage(observation),
      perceptionEventData(observation, details),
    );
    if (observation.summary) {
      await emitAutomationAiEvent(
        this.events,
        context,
        'ai.perception.summary',
        'Vision summary received.',
        perceptionSummaryData(observation, details),
      );
    }
    return {
      observation,
      plannerText: this.vision.summarizeForPlanner(observation),
    };
  }
}
