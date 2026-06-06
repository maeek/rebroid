import {
  centerOfBox,
  normalizeBox,
  type NormalizedBox,
  type NormalizedPoint,
  type VisionImageSize,
} from "./geometry";

export type VisionDetectionSource = "ui-xml" | "cv" | "vision-model";

export interface VisionImageMetadata extends VisionImageSize {
  capturedAt: string;
  mimeType: string;
  source: "screenshot" | "ui-xml";
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
  uiXml?: {
    bytes: number;
    nodeCount: number;
    truncated: boolean;
  };
}

export interface VisionLocateResult {
  matches: VisionDetection[];
  query: string;
  threshold: number;
}

export const createDetection = (
  input: Omit<VisionDetection, "bounds" | "center"> & {
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
    if (left.bounds.top !== right.bounds.top) return left.bounds.top - right.bounds.top;
    return left.bounds.left - right.bounds.left;
  });

export const matchesDetectionQuery = (
  detection: VisionDetection,
  query: string,
) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  const haystack = [
    detection.label,
    detection.text,
    detection.role,
    detection.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalizedQuery);
};
