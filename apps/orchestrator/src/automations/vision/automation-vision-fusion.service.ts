import { Injectable } from '@nestjs/common';
import {
  extractUiDetections,
  sortDetections,
  type VisionDetection,
} from './vision-observation';
import {
  rankObservationCandidates,
  reconcileScreenStateHypothesis,
  type AiObservationCandidate,
} from '../ai/core/screen-state-policy';
import { prepareUiXml } from '../ai/automation-ai-observation.utils';
import { createMarkedAiScreenshot } from '../ai/automation-ai-screenshot.utils';
import type {
  AutomationScreenObservation,
  AutomationVisionContext,
  AutomationVisionScreenState,
} from './automation-vision.types';
import type { AutomationVisionCapture } from './automation-vision-capture.service';

export interface AutomationVisionDescription {
  screenState?: AutomationVisionScreenState;
  summary?: string;
  visionSummaryError?: string;
}

@Injectable()
export class AutomationVisionFusionService {
  async fuse(
    capture: AutomationVisionCapture,
    described: AutomationVisionDescription,
    visionContext?: AutomationVisionContext,
  ): Promise<AutomationScreenObservation> {
    const { aiImage, ocr, screenshot, ui } = capture;
    const image = {
      width: aiImage.width ?? 1,
      height: aiImage.height ?? 1,
      mimeType: screenshot.mimeType,
      capturedAt: screenshot.capturedAt,
      source: 'screenshot' as const,
    };
    const uiDumpAvailable = ui.status === 'available' && Boolean(ui.xml);
    const preparedUi = uiDumpAvailable && ui.xml ? prepareUiXml(ui.xml) : null;
    const detections = preparedUi
      ? extractUiDetections(preparedUi.xml, image)
      : [];
    const uiXml = preparedUi
      ? {
          bytes: Buffer.byteLength(preparedUi.xml),
          detectionCount: detections.length,
          diagnostics: ui.diagnostics,
          nodeCount: preparedUi.nodeCount,
          rawNodeCount: ui.diagnostics?.rawNodeCount ?? preparedUi.nodeCount,
          status:
            preparedUi.nodeCount > 0
              ? ('available' as const)
              : ('empty' as const),
          truncated: preparedUi.truncated,
        }
      : {
          bytes: 0,
          detectionCount: 0,
          diagnostics: ui.diagnostics,
          error: ui.error,
          nodeCount: 0,
          rawNodeCount: ui.diagnostics?.rawNodeCount ?? 0,
          status: 'failed' as const,
          truncated: false,
        };
    const candidates = rankObservationCandidates({
      candidates: deduplicateCandidates(
        buildObservationCandidates(
          detections,
          described.screenState?.controls ?? [],
          ocr.detections,
        ),
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
    const screenState = reconcileDescription(
      described.screenState,
      reconciliation,
    );
    const summary = screenState?.summary ?? described.summary;
    const snapshotId = `screen-${image.capturedAt}`;
    const markedImage = await createMarkedAiScreenshot(aiImage, candidates);

    return {
      snapshotId,
      image,
      aiImage,
      markedImage,
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
}

const buildObservationCandidates = (
  detections: VisionDetection[],
  controls: AutomationVisionScreenState['controls'],
  ocrDetections: VisionDetection[],
): AiObservationCandidate[] => {
  const detectionCandidates = (
    values: VisionDetection[],
    source: 'ui-xml' | 'ocr',
    fallback: string,
  ) =>
    sortDetections(values).map((detection, index) => ({
      id: `${source === 'ui-xml' ? 'ui' : 'ocr'}-${index + 1}`,
      label:
        detection.label ??
        detection.text ??
        detection.description ??
        `${fallback} ${index + 1}`,
      source,
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
  return [
    ...detectionCandidates(detections, 'ui-xml', 'UI element'),
    ...detectionCandidates(ocrDetections, 'ocr', 'OCR text'),
    ...visionCandidates,
  ];
};

const reconcileDescription = (
  described: AutomationVisionScreenState | undefined,
  reconciliation: ReturnType<typeof reconcileScreenStateHypothesis> | null,
) => {
  if (!described || !reconciliation) return undefined;
  return {
    ...described,
    screenKind: reconciliation.screenKind,
    confidence: reconciliation.confidence,
    settingsAccessVisible: reconciliation.settingsAccessVisible,
    rawScreenKind: described.rawScreenKind ?? reconciliation.rawScreenKind,
    ...(reconciliation.correctionReason
      ? { correctionReason: reconciliation.correctionReason }
      : {}),
    ...(reconciliation.contradictionReason
      ? {
          uncertainty: [
            reconciliation.contradictionReason,
            ...described.uncertainty,
          ].slice(0, 12),
        }
      : {}),
  };
};

const deduplicateCandidates = (
  candidates: AiObservationCandidate[],
): AiObservationCandidate[] => {
  const accepted: AiObservationCandidate[] = [];
  for (const candidate of candidates.sort(
    (left, right) => right.confidence - left.confidence,
  )) {
    const duplicate = accepted.find(
      (current) =>
        normalizedLabel(current.label) === normalizedLabel(candidate.label) &&
        boundsOverlap(current.bounds, candidate.bounds) >= 0.7,
    );
    if (!duplicate) {
      accepted.push(candidate);
      continue;
    }
    duplicate.evidence = Array.from(
      new Set([
        ...(duplicate.evidence ?? []),
        ...(candidate.evidence ?? []),
        `also-detected-by=${candidate.source}`,
      ]),
    ).slice(0, 8);
  }
  return accepted;
};

const normalizedLabel = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const boundsOverlap = (
  left: AiObservationCandidate['bounds'],
  right: AiObservationCandidate['bounds'],
) => {
  if (!left || !right) return 0;
  const x1 = Math.max(left.left, right.left);
  const y1 = Math.max(left.top, right.top);
  const x2 = Math.min(left.left + left.width, right.left + right.width);
  const y2 = Math.min(left.top + left.height, right.top + right.height);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (intersection === 0) return 0;
  const union =
    left.width * left.height + right.width * right.height - intersection;
  return union > 0 ? intersection / union : 0;
};
