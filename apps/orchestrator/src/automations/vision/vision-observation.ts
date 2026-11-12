import { visibleUiNodes } from '@rebroid/android-application-core/ui-text';
import {
  centerOfBox,
  normalizeBox,
  type NormalizedBox,
  type NormalizedPoint,
  type VisionImageSize,
} from './vision-geometry';

export type VisionDetectionSource = 'ui-xml' | 'cv' | 'vision-model' | 'ocr';

export interface VisionImageMetadata extends VisionImageSize {
  capturedAt: string;
  mimeType: string;
  source: 'screenshot' | 'ui-xml';
}

export interface VisionDetection {
  id: string;
  label?: string;
  text?: string;
  role?: string;
  description?: string;
  confidence: number;
  bounds: NormalizedBox;
  center: NormalizedPoint;
  source: VisionDetectionSource;
}

export interface VisionObservation {
  image: VisionImageMetadata;
  detections: VisionDetection[];
  summary?: string;
  visionSummaryError?: string;
  uiXml?: {
    bytes: number;
    diagnostics?: {
      command?: string;
      compressed?: boolean;
      durationMs?: number;
      exitCode?: number | null;
      stdout?: string;
      stderr?: string;
      xmlBytes?: number;
      rawNodeCount?: number;
    };
    error?: string;
    nodeCount: number;
    detectionCount?: number;
    rawNodeCount?: number;
    status: 'available' | 'empty' | 'failed';
    truncated: boolean;
  };
  ocr?: {
    status: 'available' | 'disabled' | 'failed';
    detections: VisionDetection[];
    searchComplete?: boolean;
    elapsedMs?: number;
    engine?: string;
    model?: string;
    language?: string;
    preprocessingMode?: string;
    preprocessingAttempts?: Array<{
      mode: string;
      status: string;
      textBoxCount?: number;
      averageConfidence?: number;
      elapsedMs?: number;
      error?: string;
    }>;
    error?: string;
  };
}

interface UiXmlDetectionInput {
  width: number;
  height: number;
}

export const extractUiDetections = (
  xml: string,
  image: UiXmlDetectionInput,
) => {
  const detections: VisionDetection[] = [];
  if (!image.width || !image.height) return detections;
  for (const node of visibleUiNodes(xml)) {
    const { left, top, right, bottom } = node.bounds;
    const bounds = {
      left: left / image.width,
      top: top / image.height,
      width: (right - left) / image.width,
      height: (bottom - top) / image.height,
    };
    const text = node.text?.trim();
    const description = node.description?.trim();
    const resourceId = node.resourceId?.trim();
    const className = node.className?.trim();
    const label = text || description || resourceId || className;
    if (!label) continue;

    detections.push(
      createDetection({
        id: `ui-${detections.length + 1}`,
        label,
        ...(text ? { text } : {}),
        ...(description ? { description } : {}),
        ...(className ? { role: className.split('.').pop() ?? className } : {}),
        confidence: text || description ? 0.92 : 0.72,
        bounds,
        source: 'ui-xml',
      }),
    );
  }
  return detections;
};

export const createDetection = (
  input: Omit<VisionDetection, 'bounds' | 'center'> & {
    bounds: NormalizedBox;
    center?: NormalizedPoint;
  },
): VisionDetection => {
  const bounds = normalizeBox(input.bounds);
  return {
    ...input,
    confidence: Math.min(1, Math.max(0, input.confidence)),
    bounds,
    center: input.center ?? centerOfBox(bounds),
  };
};

export const sortDetections = (detections: VisionDetection[]) =>
  [...detections].sort((left, right) => {
    if (right.confidence !== left.confidence) {
      return right.confidence - left.confidence;
    }
    if (left.bounds.top !== right.bounds.top)
      return left.bounds.top - right.bounds.top;
    return left.bounds.left - right.bounds.left;
  });

export const matchesDetectionQuery = (
  detection: VisionDetection,
  query: string,
) => {
  const normalizedQuery = query.normalize().trim().toLowerCase();
  if (!normalizedQuery) return true;
  if (detection.source === 'ui-xml') {
    return [detection.text, detection.description].some((label) =>
      label?.normalize().toLowerCase().includes(normalizedQuery),
    );
  }
  const haystack = [
    detection.label,
    detection.text,
    detection.role,
    detection.description,
  ]
    .filter(Boolean)
    .join(' ')
    .normalize()
    .toLowerCase();
  return haystack.includes(normalizedQuery);
};
