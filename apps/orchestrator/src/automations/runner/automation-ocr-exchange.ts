import {
  ocrErrorMessage,
  type OcrSidecarTrace,
} from '../../ocr-sidecar/ocr-sidecar.protocol';
import sharp from 'sharp';
import { sanitizeAiText } from '../ai/automation-ai-observation.utils';
import {
  parseAiScreenshotDataUrl,
  type AiScreenshot,
} from '../ai/automation-ai-screenshot.utils';
import type { AutomationOcrResult } from '../vision/automation-ocr.port';

const maxLoggedDetections = 30;
const maxPreviewBytes = 24 * 1024;
interface AutomationOcrExchange {
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

export function createOcrExchange(
  result: AutomationOcrResult,
  trace: OcrSidecarTrace,
  image: AiScreenshot,
): AutomationOcrExchange {
  return {
    request: {
      method: 'POST',
      path: '/ocr/screenshot',
      image: {
        mimeType: image.mimeType,
        capturedAt: image.capturedAt,
        dataUrlBytes: Buffer.byteLength(image.dataUrl),
      },
      bodyBytes: trace.requestBytes,
      ...trace.parameters,
    },
    response: projectOcrResponse(
      result,
      {
        httpStatus: trace.httpStatus,
        code: trace.code,
        durationMs: trace.durationMs,
        bodyBytes: trace.responseBytes,
        image: trace.image,
      },
      trace.canceled,
    ),
  };
}

function projectOcrResponse(
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
  const error = ocrErrorMessage(transport.code) ?? null;
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
