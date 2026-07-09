import { summarizeObservationCandidates } from '@rebroid/ai-core/harness';
import type { AutomationScreenObservation } from './automation-vision.types';

export const summarizeVisionObservationForPlanner = (
  observation: AutomationScreenObservation,
) => {
  const visionState = observation.summary
    ? `Vision hypothesis: available${observation.screenState ? `, screenKind=${observation.screenState.screenKind}, confidence=${observation.screenState.confidence}` : ''}.`
    : observation.visionSummaryError
      ? `Vision summary failed: ${observation.visionSummaryError}`
      : 'Vision model summary: unavailable; planner cannot inspect screenshot pixels directly and must rely on UI hierarchy detections/text.';
  const visibilityWarning =
    !observation.summary && observation.detections.length === 0
      ? 'Visibility warning: no UI hierarchy detections and no vision summary are available. The planner should ask the user for more context, use non-visual Android state-reading tools, or request a configured vision model instead of guessing screen contents.'
      : '';
  const ocrState = observation.ocr
    ? `OCR: ${observation.ocr.status}, ${observation.ocr.detections.length} text box(es)${observation.ocr.preprocessingMode ? `, preprocessing=${observation.ocr.preprocessingMode}` : ''}${observation.ocr.elapsedMs !== undefined ? `, elapsedMs=${observation.ocr.elapsedMs}` : ''}${observation.ocr.error ? `, error=${observation.ocr.error}` : ''}.`
    : 'OCR: unavailable.';
  const lines = [
    `Screen observation: ${observation.image.width}x${observation.image.height}, captured ${observation.image.capturedAt}.`,
    observation.uiXml
      ? `UI hierarchy: ${observation.uiXml.status}, ${observation.uiXml.nodeCount} node(s), ${observation.uiXml.detectionCount ?? observation.detections.length} labeled detection(s), ${observation.uiXml.bytes} byte(s), truncated=${observation.uiXml.truncated}${observation.uiXml.rawNodeCount !== undefined ? `, rawNodeCount=${observation.uiXml.rawNodeCount}` : ''}${observation.uiXml.error ? `, error=${observation.uiXml.error}` : ''}.`
      : 'UI hierarchy: unavailable.',
    ocrState,
    'Grounding precedence: confirmed Android facts > UI XML > OCR text > visual hypothesis.',
    visionState,
    visibilityWarning,
    observation.screenState
      ? `Vision hypothesis details: ${JSON.stringify({
          screenKind: observation.screenState.screenKind,
          rawScreenKind: observation.screenState.rawScreenKind ?? null,
          correctionReason: observation.screenState.correctionReason ?? null,
          reconciliation: observation.reconciliation ?? null,
          settingsAccessVisible:
            observation.screenState.settingsAccessVisible ?? null,
          confidence: observation.screenState.confidence,
          visibleText: observation.screenState.visibleText,
          controls: observation.screenState.controls,
          evidence: observation.screenState.evidence,
          uncertainty: observation.screenState.uncertainty,
          summary: observation.screenState.summary,
        })}`
      : observation.summary
        ? `Vision hypothesis summary: ${observation.summary}`
        : '',
    observation.reconciliation?.contradictionReason
      ? `Vision contradiction: ${observation.reconciliation.contradictionReason}`
      : '',
    summarizeObservationCandidates({
      candidates: observation.candidates,
      maxCandidates: 12,
    }),
    'Confirmed tool facts: none yet in this observation. Later tool results override conflicting vision hypotheses unless a newer observation proves otherwise.',
    'UI hierarchy detections use normalized bounds and centers in 0..1 screen coordinates:',
    ...observation.detections.slice(0, 40).map((detection, index) =>
      JSON.stringify({
        n: index + 1,
        label: detection.label,
        text: detection.text,
        role: detection.role,
        description: detection.description,
        confidence: detection.confidence,
        bounds: detection.bounds,
        center: detection.center,
        source: detection.source,
      }),
    ),
    observation.ocr?.detections.length
      ? 'OCR detections use normalized bounds and centers in 0..1 screen coordinates:'
      : '',
    ...(observation.ocr?.detections.slice(0, 30).map((detection, index) =>
      JSON.stringify({
        n: index + 1,
        label: detection.label,
        text: detection.text,
        confidence: detection.confidence,
        bounds: detection.bounds,
        center: detection.center,
        source: detection.source,
      }),
    ) ?? []),
  ].filter(Boolean);
  return lines.join('\n');
};
