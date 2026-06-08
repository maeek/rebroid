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

export interface PixelPoint {
  x: number;
  y: number;
}

export interface PixelBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const clampUnit = (value: number) =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export const normalizePoint = (point: NormalizedPoint): NormalizedPoint => ({
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

export const normalizedBoxToPixels = (
  box: NormalizedBox,
  image: VisionImageSize,
): PixelBox => {
  const normalized = normalizeBox(box);
  return {
    left: Math.round(normalized.left * image.width),
    top: Math.round(normalized.top * image.height),
    width: Math.round(normalized.width * image.width),
    height: Math.round(normalized.height * image.height),
  };
};

export const pixelBoxToNormalized = (
  box: PixelBox,
  image: VisionImageSize,
): NormalizedBox => {
  const width = Math.max(1, image.width);
  const height = Math.max(1, image.height);
  return normalizeBox({
    left: box.left / width,
    top: box.top / height,
    width: box.width / width,
    height: box.height / height,
  });
};

export const pointWithinBox = (point: NormalizedPoint, box: NormalizedBox) => {
  const p = normalizePoint(point);
  const b = normalizeBox(box);
  return (
    p.x >= b.left &&
    p.x <= b.left + b.width &&
    p.y >= b.top &&
    p.y <= b.top + b.height
  );
};
