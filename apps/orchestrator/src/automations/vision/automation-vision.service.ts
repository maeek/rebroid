import { Injectable } from '@nestjs/common';
import {
  matchesDetectionQuery,
  sortDetections,
} from '@rebroid/vision-core/observation';
import { pointWithinBox } from '@rebroid/vision-core/geometry';
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
} from '@rebroid/ai-core/provider';
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
    const capture = await this.captureService.capture(context);
    const described = visionModel
      ? await this.modelService.describeSafe({
          image: capture.aiImage,
          abortSignal: context.abortSignal,
          deadline,
          visionContext,
          ...visionModel,
        })
      : {};
    return this.fusionService.fuse(capture, described, visionContext);
  }

  async locate(
    context: Pick<AutomationCommandContext, 'adb' | 'app' | 'abortSignal'>,
    input: AutomationVisionLocateInput,
    visionModel?: VisionModelSelection,
    deadline?: number,
  ): Promise<AutomationVisionLocateOutput> {
    const observation = await this.observe(context, undefined, deadline);
    const matches = sortDetections(
      observation.detections.filter((detection) => {
        if (detection.confidence < input.threshold) return false;
        if (!matchesDetectionQuery(detection, input.query)) return false;
        return input.region
          ? pointWithinBox(detection.center, input.region)
          : true;
      }),
    ).slice(0, input.maxResults);
    if (matches.length === 0 && visionModel && observation.aiImage) {
      return this.modelService.locateSafe({
        image: observation.aiImage,
        abortSignal: context.abortSignal,
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

  summarizeForPlanner(observation: AutomationScreenObservation) {
    return summarizeVisionObservationForPlanner(observation);
  }
}
