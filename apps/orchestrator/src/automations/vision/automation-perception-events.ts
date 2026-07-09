import { summarizeVisualAffordances } from '@rebroid/ai-core/harness';
import type { AutomationVisionService } from './automation-vision.service';

type Observation = Awaited<ReturnType<AutomationVisionService['observe']>>;

const uiData = (observation: Observation) => ({
  uiNodes: observation.uiXml?.nodeCount ?? null,
  uiDetectionCount:
    observation.uiXml?.detectionCount ?? observation.detections.length,
  uiRawNodeCount: observation.uiXml?.rawNodeCount ?? null,
  uiStatus: observation.uiXml?.status ?? 'unavailable',
  uiError: observation.uiXml?.error ?? null,
  uiBytes: observation.uiXml?.bytes ?? null,
  uiDiagnostics: observation.uiXml?.diagnostics ?? null,
});

const ocrData = (observation: Observation) => ({
  ocrStatus: observation.ocr?.status ?? 'unavailable',
  ocrTextCount: observation.ocr?.detections.length ?? 0,
  ocrElapsedMs: observation.ocr?.elapsedMs ?? null,
  ocrEngine: observation.ocr?.engine ?? null,
  ocrModel: observation.ocr?.model ?? null,
  ocrLanguages: observation.ocr?.languages ?? [],
  ocrPreprocessingMode: observation.ocr?.preprocessingMode ?? null,
  ocrPreprocessingAttempts: observation.ocr?.preprocessingAttempts ?? [],
  ocrError: observation.ocr?.error ?? null,
  ocrDetections: observation.ocr?.detections.slice(0, 30) ?? [],
});

const visionData = (observation: Observation, goal?: string) => ({
  hasVisionSummary: Boolean(observation.summary),
  screenKind: observation.screenState?.screenKind ?? null,
  rawScreenKind: observation.screenState?.rawScreenKind ?? null,
  screenKindCorrectionReason: observation.screenState?.correctionReason ?? null,
  settingsAccessVisible: observation.screenState?.settingsAccessVisible ?? null,
  visionConfidence: observation.screenState?.confidence ?? null,
  visibleText: observation.screenState?.visibleText.slice(0, 20) ?? [],
  controls: observation.screenState?.controls.slice(0, 20) ?? [],
  candidates: observation.candidates.slice(0, 20),
  markedScreenshotId: observation.markedScreenshotId,
  reconciliation: observation.reconciliation ?? null,
  visualAffordances: summarizeVisualAffordances({
    state: observation.screenState ?? null,
    goal,
  }),
  visionEvidence: observation.screenState?.evidence ?? [],
  visionUncertainty: observation.screenState?.uncertainty ?? [],
});

export const perceptionEventData = (
  observation: Observation,
  context: {
    clientMessageId?: string | null;
    reason: string;
    uses?: string;
    goal?: string;
  },
) => ({
  clientMessageId: context.clientMessageId ?? null,
  reason: context.reason,
  uses: context.uses ?? null,
  width: observation.image.width,
  height: observation.image.height,
  capturedAt: observation.image.capturedAt,
  detections: observation.detections.length,
  ...uiData(observation),
  ...ocrData(observation),
  ...visionData(observation, context.goal),
});

export const perceptionSummaryData = (
  observation: Observation,
  context: {
    clientMessageId?: string | null;
    reason: string;
    uses?: string;
    goal?: string;
  },
) => {
  const data = perceptionEventData(observation, context);
  return {
    ...data,
    evidence: data.visionEvidence,
    uncertainty: data.visionUncertainty,
  };
};

export const perceptionObservationMessage = (observation: Observation) => {
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
};
