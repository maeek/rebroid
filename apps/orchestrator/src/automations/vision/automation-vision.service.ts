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

type VisionContext = Pick<
  AutomationCommandContext,
  | 'adb'
  | 'app'
  | 'abortSignal'
  | 'visionSnapshot'
  | 'recordOcrExchange'
  | 'withTarget'
>;

@Injectable()
export class AutomationVisionService {
  constructor(
    private readonly captureService: AutomationVisionCaptureService,
    private readonly fusionService: AutomationVisionFusionService,
    private readonly modelService: AutomationVisionModelService,
  ) {}

  async observe(
    context: VisionContext,
    visionModel?: VisionModelSelection,
    deadline?: number,
    visionContext?: AutomationVisionContext,
  ): Promise<AutomationScreenObservation> {
    const signal = observationSignal(context.abortSignal, deadline);
    if (context.visionSnapshot) {
      await context.withTarget?.(signal, async () => undefined);
      const snapshot = context.visionSnapshot;
      if (!visionModel || !snapshot.aiImage) return snapshot;
      const described = await this.modelService.describeSafe({
        image: snapshot.aiImage,
        abortSignal: signal,
        deadline,
        visionContext,
        ...visionModel,
      });
      signal?.throwIfAborted();
      return { ...snapshot, ...described };
    }
    const capture = await this.captureService.capture(
      { ...context, abortSignal: signal },
      deadline,
    );
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
    context: VisionContext,
    input: AutomationVisionLocateInput,
    visionModel?: VisionModelSelection,
    deadline?: number,
  ): Promise<AutomationVisionLocateOutput> {
    const signal = observationSignal(context.abortSignal, deadline);
    const { visionSnapshot } = context;
    if (visionSnapshot)
      await context.withTarget?.(signal, async () => undefined);
    const evidence = visionSnapshot
      ? {
          detections: visionSnapshot.lookupDetections ?? [
            ...visionSnapshot.detections,
            ...(visionSnapshot.ocr?.detections ?? []),
          ],
          image: visionSnapshot.aiImage,
          ocr: visionSnapshot.ocr,
        }
      : await this.captureForLookup(context, signal, deadline);
    signal?.throwIfAborted();
    const ocrStatus: AutomationVisionLocateOutput['ocrStatus'] =
      evidence.ocr?.status ?? 'unavailable';
    const base = { query: input.query, threshold: input.threshold, ocrStatus };
    const matches = sortDetections(
      evidence.detections.filter(
        (detection) =>
          matchesDetectionQuery(detection, input.query) &&
          matchesVisionLocateBounds(detection, input),
      ),
    ).slice(0, input.maxResults);
    if (matches.length > 0) return { ...base, matches, outcome: 'found' };
    if (visionModel && evidence.image) {
      const result = await this.modelService.locateSafe({
        image: evidence.image,
        abortSignal: signal,
        deadline,
        input,
        ...visionModel,
      });
      signal?.throwIfAborted();
      const emptyOutcome = result.failed ? 'inconclusive' : 'not_found';
      return {
        ...base,
        matches: result.matches,
        outcome: result.matches.length ? 'found' : emptyOutcome,
        reason: result.reason,
      };
    }
    const incompleteOcr = evidence.ocr?.searchComplete === false;
    const complete =
      ocrStatus === 'available' && !incompleteOcr && !visionModel;
    let reason =
      'No match in the available evidence and screenshot recognition was unavailable.';
    if (complete) reason = 'No match in the available screen evidence.';
    else if (incompleteOcr)
      reason =
        'No match in the available evidence and OCR preprocessing was incomplete.';
    return {
      ...base,
      matches,
      outcome: complete ? 'not_found' : 'inconclusive',
      reason,
    };
  }

  private async captureForLookup(
    context: VisionContext,
    abortSignal?: AbortSignal,
    deadline?: number,
  ) {
    const capture = await this.captureService.capture(
      { ...context, abortSignal },
      deadline,
    );
    return {
      detections: this.fusionService.lookupDetections(capture),
      image: capture.aiImage,
      ocr: capture.ocr,
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
