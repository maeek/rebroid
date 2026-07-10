import type { AutomationScreenObservation } from './automation-vision.types';

export const summarizeVisionObservationForPlanner = (
  observation: AutomationScreenObservation,
) => {
  const candidates = observation.candidates.slice(0, 30).map((candidate) => {
    const bounds = candidate.bounds
      ? `${round(candidate.bounds.left)},${round(candidate.bounds.top)},${round(candidate.bounds.width)},${round(candidate.bounds.height)}`
      : 'none';
    return `- ${candidate.id} | ${candidate.label} | source=${candidate.source} | confidence=${round(candidate.confidence)} | bounds=${bounds}`;
  });
  return [
    `snapshotId=${observation.snapshotId}`,
    `screen=${observation.image.width}x${observation.image.height}; capturedAt=${observation.image.capturedAt}`,
    `ui=${observation.uiXml?.status ?? 'unavailable'}; uiNodes=${observation.uiXml?.nodeCount ?? 0}`,
    `ocr=${observation.ocr?.status ?? 'unavailable'}; ocrBoxes=${observation.ocr?.detections.length ?? 0}`,
    observation.screenState
      ? `screenKind=${observation.screenState.screenKind}; confidence=${round(observation.screenState.confidence)}; summary=${observation.screenState.summary}`
      : observation.summary
        ? `visualSummary=${observation.summary}`
        : 'visualSummary=unavailable',
    observation.visionSummaryError
      ? `visualError=${observation.visionSummaryError}`
      : '',
    candidates.length > 0
      ? `Candidates (use IDs for taps):\n${candidates.join('\n')}`
      : 'Candidates: none. Do not guess coordinates or screen contents.',
  ]
    .filter(Boolean)
    .join('\n');
};

const round = (value: number) => Math.round(value * 1000) / 1000;
