import { Injectable } from '@nestjs/common';
import { matchesDetectionQuery, sortDetections } from './vision-observation';
import { matchesVisionLocateBounds } from './vision-geometry';
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
} from '../../settings/contracts/ai-provider';
import type { AutomationCommandContext } from '../commands/automation-command.types';
import { AutomationVisionCaptureService } from './automation-vision-capture.service';
import { AutomationVisionFusionService } from './automation-vision-fusion.service';
import { AutomationVisionModelService } from './automation-vision-model.service';
import { summarizeVisionObservationForPlanner } from './automation-vision-planner-summary';
import type {
  AutomationScreenObservation,
  AutomationVisionContext,
  AutomationVisionLocateInput,
  AutomationVisionLocateOutput,
} from './automation-vision.types';

interface VisionModelSelection {
  provider: AutomationAiProvider;
  model: AutomationAiProviderModel;
}

@Injectable()
export class AutomationVisionService {
  constructor(
    private readonly captureService: AutomationVisionCaptureService,
    private readonly fusionService: AutomationVisionFusionService,
    private readonly modelService: AutomationVisionModelService,
  ) {}

  async observe(
    context: Pick<AutomationCommandContext, 'adb' | 'app' | 'abortSignal'>,
    visionModel?: VisionModelSelection,
    deadline?: number,
    visionContext?: AutomationVisionContext,
  ): Promise<AutomationScreenObservation> {
    const signal = observationSignal(context.abortSignal, deadline);
    const capture = await this.captureService.capture({
      ...context,
      abortSignal: signal,
    });
    const described = visionModel
      ? await this.modelService.describeSafe({
          image: capture.aiImage,
          abortSignal: signal,
          deadline,
          visionContext,
          ...visionModel,
        })
      : {};
    signal?.throwIfAborted();
    const observation = await this.fusionService.fuse(
      capture,
      described,
      visionContext,
    );
    signal?.throwIfAborted();
    return observation;
  }

  async locate(
    context: Pick<AutomationCommandContext, 'adb' | 'app' | 'abortSignal'>,
    input: AutomationVisionLocateInput,
    visionModel?: VisionModelSelection,
    deadline?: number,
  ): Promise<AutomationVisionLocateOutput> {
    const signal = observationSignal(context.abortSignal, deadline);
    const capture = await this.captureService.capture({
      ...context,
      abortSignal: signal,
    });
    signal?.throwIfAborted();
    const matches = sortDetections(
      this.fusionService
        .lookupDetections(capture)
        .filter(
          (detection) =>
            matchesDetectionQuery(detection, input.query) &&
            matchesVisionLocateBounds(detection, input),
        ),
    ).slice(0, input.maxResults);
    if (matches.length === 0 && visionModel) {
      const result = await this.modelService.locateSafe({
        image: capture.aiImage,
        abortSignal: signal,
        deadline,
        input,
        ...visionModel,
      });
      signal?.throwIfAborted();
      return result;
    }

    return {
      matches,
      query: input.query,
      threshold: input.threshold,
      ...(matches.length === 0
        ? {
            reason:
              'No matching fused UI, OCR, or visual candidates were found on the current screen.',
          }
        : {}),
    };
  }

  summarizeForPlanner(observation: AutomationScreenObservation) {
    return summarizeVisionObservationForPlanner(observation);
  }
}

const observationSignal = (signal?: AbortSignal, deadline?: number) => {
  signal?.throwIfAborted();
  if (deadline === undefined) return signal;
  const remaining = deadline - Date.now();
  if (remaining <= 0)
    throw new DOMException('Observation deadline expired.', 'TimeoutError');
  const timeout = AbortSignal.timeout(remaining);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
};
