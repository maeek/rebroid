import sharp from 'sharp';
import { sanitizeAiText } from '../ai/automation-ai-observation.utils';
import {
  parseAiScreenshotDataUrl,
  type AiScreenshot,
} from '../ai/automation-ai-screenshot.utils';
import type { AutomationOcrResult } from './automation-ocr.port';

const maxLoggedDetections = 30;
const maxPreviewBytes = 24 * 1024;
const errorMessages: Readonly<Record<string, string>> = {
  ocr_busy: 'OCR inference capacity is busy.',
  ocr_not_ready: 'OCR model is not ready.',
  unsupported_language: 'The requested OCR language is unavailable.',
  invalid_image: 'The sidecar rejected the image.',
  ocr_deadline_exceeded: 'The sidecar reached its deadline.',
  ocr_failed: 'OCR inference failed.',
  ocr_timeout: 'OCR request timed out.',
  ocr_transport_error: 'The OCR response could not be read.',
  ocr_invalid_response: 'OCR sidecar returned an invalid response.',
};

export interface AutomationOcrExchange {
  request: {
    method: 'POST';
    path: '/ocr/screenshot';
    image: { mimeType: string; capturedAt: string; dataUrlBytes: number };
    bodyBytes: number;
    language: string;
    minConfidence: number;
    maxImageDimension: number;
    timeoutMs: number;
  };
  response: {
    httpStatus: number | null;
    code: string | null;
    status: 'available' | 'failed' | 'canceled';
    durationMs: number;
    bodyBytes: number | null;
    language: string | null;
    engine: string | null;
    model: string | null;
    image: { width: number; height: number } | null;
    elapsedMs: number | null;
    preprocessingMode: string | null;
    preprocessingAttempts: NonNullable<
      AutomationOcrResult['preprocessingAttempts']
    >;
    detectionCount: number;
    omittedDetectionCount?: number;
    detections: Array<
      Pick<
        AutomationOcrResult['detections'][number],
        'text' | 'confidence' | 'bounds'
      >
    >;
    error: string | null;
  };
}

export type AutomationOcrExchangeRecorder = (
  exchange: AutomationOcrExchange,
  preview: { dataUrl: string; width: number; height: number } | null,
) => Promise<void>;

export function projectOcrResponse(
  result: AutomationOcrResult,
  transport: Pick<
    AutomationOcrExchange['response'],
    'httpStatus' | 'code' | 'durationMs' | 'bodyBytes' | 'image'
  >,
  canceled: boolean,
): AutomationOcrExchange['response'] {
  const text = (value: string | undefined, max: number) =>
    value ? sanitizeAiText(value, max) : null;
  let status: AutomationOcrExchange['response']['status'] = 'failed';
  if (result.status === 'available') status = 'available';
  if (canceled) status = 'canceled';
  const code = transport.code ?? '';
  const error = Object.hasOwn(errorMessages, code) ? errorMessages[code] : null;
  const omitted = Math.max(0, result.detections.length - maxLoggedDetections);
  return {
    ...transport,
    status,
    language: text(result.language, 32),
    engine: text(result.engine, 80),
    model: text(result.model, 120),
    elapsedMs: result.elapsedMs ?? null,
    preprocessingMode: text(result.preprocessingMode, 40),
    preprocessingAttempts: (result.preprocessingAttempts ?? [])
      .slice(0, 8)
      .map(
        ({
          mode,
          status,
          textBoxCount,
          averageConfidence,
          qualityScore,
          elapsedMs,
          error,
        }) => ({
          mode: sanitizeAiText(mode, 40),
          status: sanitizeAiText(status, 40),
          textBoxCount,
          averageConfidence,
          qualityScore,
          elapsedMs,
          ...(error ? { error: 'OCR pass failed.' } : {}),
        }),
      ),
    detectionCount: result.detections.length,
    ...(omitted ? { omittedDetectionCount: omitted } : {}),
    detections: result.detections
      .slice(0, maxLoggedDetections)
      .map((detection) => ({
        text: sanitizeAiText(detection.text ?? detection.label ?? '', 300),
        confidence: detection.confidence,
        bounds: detection.bounds,
      })),
    error: canceled ? 'The OCR request was canceled.' : error,
  };
}

export async function createOcrInputPreview(image: AiScreenshot) {
  try {
    const source = parseAiScreenshotDataUrl(image.dataUrl);
    if (!source) return null;
    const { data, info } = await sharp(source.buffer, {
      limitInputPixels: 4096 * 4096,
    })
      .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 52 })
      .toBuffer({ resolveWithObject: true });
    if (data.length > maxPreviewBytes) return null;
    return {
      dataUrl: `data:image/jpeg;base64,${data.toString('base64')}`,
      width: info.width,
      height: info.height,
    };
  } catch {
    return null;
  }
}
