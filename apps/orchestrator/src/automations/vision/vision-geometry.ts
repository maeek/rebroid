export interface VisionImageSize {
  width: number;
  height: number;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface NormalizedBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface PixelPoint {
  x: number;
  y: number;
}

const clampUnit = (value: number) =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

const normalizePoint = (point: NormalizedPoint): NormalizedPoint => ({
  x: clampUnit(point.x),
  y: clampUnit(point.y),
});

export const normalizeBox = (box: NormalizedBox): NormalizedBox => {
  const left = clampUnit(box.left);
  const top = clampUnit(box.top);
  return {
    left,
    top,
    width: Math.min(1 - left, Math.max(0, box.width)),
    height: Math.min(1 - top, Math.max(0, box.height)),
  };
};

export const centerOfBox = (box: NormalizedBox): NormalizedPoint => {
  const normalized = normalizeBox(box);
  return normalizePoint({
    x: normalized.left + normalized.width / 2,
    y: normalized.top + normalized.height / 2,
  });
};

export const normalizedPointToPixels = (
  point: NormalizedPoint,
  image: VisionImageSize,
): PixelPoint => {
  const normalized = normalizePoint(point);
  return {
    x: Math.round(normalized.x * Math.max(0, image.width - 1)),
    y: Math.round(normalized.y * Math.max(0, image.height - 1)),
  };
};

const pointWithinBox = (point: NormalizedPoint, box: NormalizedBox) => {
  const p = normalizePoint(point);
  const b = normalizeBox(box);
  return (
    p.x >= b.left &&
    p.x <= b.left + b.width &&
    p.y >= b.top &&
    p.y <= b.top + b.height
  );
};

export const matchesVisionLocateBounds = (
  detection: { confidence: number; center: { x: number; y: number } },
  input: { threshold: number; region?: Parameters<typeof pointWithinBox>[1] },
) =>
  detection.confidence >= input.threshold &&
  (!input.region || pointWithinBox(detection.center, input.region));
