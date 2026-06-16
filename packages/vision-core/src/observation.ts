import {
  centerOfBox,
  normalizeBox,
  type NormalizedBox,
  type NormalizedPoint,
  type VisionImageSize,
} from "./geometry";

export type VisionDetectionSource = "ui-xml" | "cv" | "vision-model" | "ocr";

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
    status: "available" | "empty" | "failed";
    truncated: boolean;
  };
  ocr?: {
    status: "available" | "disabled" | "failed";
    detections: VisionDetection[];
    elapsedMs?: number;
    engine?: string;
    model?: string;
    languages?: string[];
    error?: string;
  };
}

export interface VisionLocateResult {
  matches: VisionDetection[];
  query: string;
  threshold: number;
}

const XML_NODE_PATTERN = /<node\b[^>]*>/g;
const XML_ATTRIBUTE_PATTERN = /([\w:-]+)="([^"]*)"/g;

export interface UiXmlDetectionInput {
  width: number;
  height: number;
}

export const extractUiDetections = (
  xml: string,
  image: UiXmlDetectionInput,
) => {
  const detections: VisionDetection[] = [];
  for (const match of xml.matchAll(XML_NODE_PATTERN)) {
    const attributes = attributesOf(match[0]);
    const bounds = boundsOf(attributes.bounds, image);
    if (!bounds) continue;

    const text = cleanAttribute(attributes.text);
    const description = cleanAttribute(attributes["content-desc"]);
    const resourceId = cleanAttribute(attributes["resource-id"]);
    const className = cleanAttribute(attributes.class);
    const label = text || description || resourceId || className;
    if (!label) continue;

    detections.push(
      createDetection({
        id: `ui-${detections.length + 1}`,
        label,
        ...(text ? { text } : {}),
        ...(description ? { description } : {}),
        ...(className ? { role: className.split(".").pop() ?? className } : {}),
        confidence: text || description ? 0.92 : 0.72,
        bounds,
        source: "ui-xml",
      }),
    );
  }
  return detections;
};

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
    if (left.bounds.top !== right.bounds.top)
      return left.bounds.top - right.bounds.top;
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

const attributesOf = (node: string) => {
  const attributes: Record<string, string> = {};
  for (const match of node.matchAll(XML_ATTRIBUTE_PATTERN)) {
    attributes[match[1]] = decodeXml(match[2]);
  }
  return attributes;
};

const decodeXml = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const cleanAttribute = (value: string | undefined) => {
  const next = value?.trim();
  return next && next !== "false" && next !== "true" ? next : "";
};

const boundsOf = (
  value: string | undefined,
  image: UiXmlDetectionInput,
): NormalizedBox | null => {
  if (!image.width || !image.height) {
    return null;
  }
  const bounds = value?.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)]$/);
  if (!bounds) return null;
  const left = Number(bounds[1]);
  const top = Number(bounds[2]);
  const right = Number(bounds[3]);
  const bottom = Number(bounds[4]);
  if (![left, top, right, bottom].every(Number.isFinite)) return null;

  const width = Math.max(1, image.width);
  const height = Math.max(1, image.height);
  return {
    left: left / width,
    top: top / height,
    width: Math.max(0, right - left) / width,
    height: Math.max(0, bottom - top) / height,
  };
};
