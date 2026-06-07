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
      .toBuffer();

    return {
      dataUrl: `data:image/jpeg;base64,${output.toString('base64')}`,
      mimeType: 'image/jpeg',
      capturedAt: screenshot.capturedAt,
      optimized: true,
      originalBytes: parsed.buffer.length,
      bytes: output.length,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
    };
  } catch {
    return fallbackScreenshot(screenshot, parsed.buffer.length, null, null);
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
});
