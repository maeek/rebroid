import sharp from 'sharp';

const DATA_URL_PATTERN = /^data:([^;,]+);base64,([\s\S]+)$/;
const AI_SCREENSHOT_MAX_DIMENSION = 720;
const AI_SCREENSHOT_JPEG_QUALITY = 68;

export interface AiScreenshot {
  dataUrl: string;
  mimeType: string;
  capturedAt: string;
}

export interface OptimizedAiScreenshot extends AiScreenshot {
  optimized: boolean;
  originalBytes: number;
  bytes: number;
  width: number | null;
  height: number | null;
  renderedWidth: number | null;
  renderedHeight: number | null;
}

export interface MarkedScreenshotCandidate {
  id: string;
  bounds?: { left: number; top: number; width: number; height: number };
}

export const optimizeAiScreenshot = async (
  screenshot: AiScreenshot,
): Promise<OptimizedAiScreenshot> => {
  const parsed = parseAiScreenshotDataUrl(screenshot.dataUrl);
  if (!parsed) {
    return fallbackScreenshot(screenshot, 0, null, null);
  }

  try {
    const image = sharp(parsed.buffer, {
      limitInputPixels: 4096 * 4096,
    }).rotate();
    const metadata = await image.metadata();
    const output = await image
      .resize({
        width: AI_SCREENSHOT_MAX_DIMENSION,
        height: AI_SCREENSHOT_MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({
        quality: AI_SCREENSHOT_JPEG_QUALITY,
        mozjpeg: true,
      })
      .toBuffer({ resolveWithObject: true });

    return {
      dataUrl: `data:image/jpeg;base64,${output.data.toString('base64')}`,
      mimeType: 'image/jpeg',
      capturedAt: screenshot.capturedAt,
      optimized: true,
      originalBytes: parsed.buffer.length,
      bytes: output.data.length,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      renderedWidth: output.info.width,
      renderedHeight: output.info.height,
    };
  } catch {
    return fallbackScreenshot(screenshot, parsed.buffer.length, null, null);
  }
};

export const createMarkedAiScreenshot = async (
  image: OptimizedAiScreenshot,
  candidates: MarkedScreenshotCandidate[],
): Promise<OptimizedAiScreenshot> => {
  const parsed = parseAiScreenshotDataUrl(image.dataUrl);
  const width = image.renderedWidth ?? image.width;
  const height = image.renderedHeight ?? image.height;
  if (!parsed || !width || !height) return image;
  const visible = candidates
    .filter((candidate) => candidate.bounds)
    .slice(0, 30);
  if (visible.length === 0) return image;
  const markup = visible
    .map((candidate, index) => {
      const bounds = candidate.bounds!;
      const left = Math.max(0, Math.round(bounds.left * width));
      const top = Math.max(0, Math.round(bounds.top * height));
      const boxWidth = Math.max(2, Math.round(bounds.width * width));
      const boxHeight = Math.max(2, Math.round(bounds.height * height));
      const label = escapeSvg(candidate.id || String(index + 1));
      const labelWidth = Math.max(24, Math.min(110, label.length * 8 + 8));
      const labelTop = Math.max(0, top - 20);
      return [
        `<rect x="${left}" y="${top}" width="${boxWidth}" height="${boxHeight}" fill="none" stroke="#ff2d55" stroke-width="3"/>`,
        `<rect x="${left}" y="${labelTop}" width="${labelWidth}" height="20" rx="3" fill="#ff2d55"/>`,
        `<text x="${left + 4}" y="${labelTop + 15}" font-size="13" font-family="sans-serif" font-weight="700" fill="white">${label}</text>`,
      ].join('');
    })
    .join('');
  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${markup}</svg>`,
  );
  try {
    const output = await sharp(parsed.buffer)
      .composite([{ input: overlay, top: 0, left: 0 }])
      .jpeg({ quality: AI_SCREENSHOT_JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    return {
      ...image,
      dataUrl: `data:image/jpeg;base64,${output.toString('base64')}`,
      bytes: output.length,
    };
  } catch {
    return image;
  }
};

export const readAiScreenshotMetadata = async (screenshot: AiScreenshot) => {
  const parsed = parseAiScreenshotDataUrl(screenshot.dataUrl);
  if (!parsed) return { width: null, height: null };
  try {
    const metadata = await sharp(parsed.buffer, {
      limitInputPixels: 4096 * 4096,
    })
      .rotate()
      .metadata();
    return {
      width: metadata.width ?? null,
      height: metadata.height ?? null,
    };
  } catch {
    return { width: null, height: null };
  }
};

export const parseAiScreenshotDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(DATA_URL_PATTERN);
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
};

const fallbackScreenshot = (
  screenshot: AiScreenshot,
  originalBytes: number,
  width: number | null,
  height: number | null,
): OptimizedAiScreenshot => ({
  ...screenshot,
  optimized: false,
  originalBytes,
  bytes: originalBytes,
  width,
  height,
  renderedWidth: width,
  renderedHeight: height,
});

const escapeSvg = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    if (character === '&') return '&amp;';
    if (character === '<') return '&lt;';
    if (character === '>') return '&gt;';
    if (character === '"') return '&quot;';
    return '&apos;';
  });
