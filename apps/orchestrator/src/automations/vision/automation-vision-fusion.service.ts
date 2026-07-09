import { Injectable } from '@nestjs/common';
import {
  extractUiDetections,
  sortDetections,
  type VisionDetection,
} from '@rebroid/vision-core/observation';
import {
  rankObservationCandidates,
  reconcileScreenStateHypothesis,
  type AiObservationCandidate,
} from '@rebroid/ai-core/harness';
import { prepareUiXml } from '../ai/automation-ai-observation.utils';
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
  fuse(
    capture: AutomationVisionCapture,
    described: AutomationVisionDescription,
    visionContext?: AutomationVisionContext,
  ): AutomationScreenObservation {
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
      candidates: buildObservationCandidates(
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
    const screenState = reconcileDescription(
      described.screenState,
      reconciliation,
    );
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
