import { z } from 'zod';

const coordinate = z.number().min(0).max(1);
const language = z.string().min(1).max(16);
const text = z.string().max(1000);
const detectionLabel = z.string().max(1024);
const maxDetections = 512;

export const ocrImageSchema = z.object({
  width: z.number().int().min(1).max(4096),
  height: z.number().int().min(1).max(4096),
});

export const ocrReadinessSchema = z.object({
  ready: z.boolean(),
  language,
  ok: z.boolean().optional(),
  status: z.string().max(40).optional(),
  service: z.string().max(80).optional(),
  engine: z.string().max(80).optional(),
  message: text.optional(),
  warmupState: z
    .enum(['initializing', 'retrying', 'ready', 'failed'])
    .optional(),
  failureCode: z
    .string()
    .regex(/^[a-z_]{1,60}$/)
    .optional(),
  preprocessingModes: z.array(z.string().max(40)).max(8).optional(),
});

export const ocrRecognitionSchema = z.object({
  status: z.literal('available'),
  language,
  searchComplete: z.boolean().optional(),
  detections: z
    .array(z.unknown())
    .max(maxDetections)
    .pipe(
      z.array(
        z
          .object({
            id: z.string().max(128).optional(),
            text: detectionLabel.optional(),
            label: detectionLabel.optional(),
            confidence: coordinate.optional(),
            bounds: z.object({
              left: coordinate,
              top: coordinate,
              width: coordinate,
              height: coordinate,
            }),
          })
          .refine(({ label, text }) => Boolean((label ?? text)?.trim())),
      ),
    ),
  elapsedMs: z.number().nonnegative().optional(),
  engine: z.string().max(80).optional(),
  model: z.string().max(120).optional(),
  preprocessingMode: z.string().max(40).optional(),
  preprocessingAttempts: z.unknown().optional(),
});

const attemptSchema = z.object({
  mode: z.string().min(1).max(40),
  status: z.string().min(1).max(40),
  textBoxCount: z.number().int().nonnegative().optional(),
  averageConfidence: coordinate.optional(),
  qualityScore: coordinate.optional(),
  elapsedMs: z.number().nonnegative().optional(),
  error: text.optional(),
});

export type OcrPreprocessingAttempt = z.infer<typeof attemptSchema>;
export type OcrSidecarRecognition = z.infer<typeof ocrRecognitionSchema>;
export type OcrSidecarReadiness = z.infer<typeof ocrReadinessSchema>;

export const ocrErrorSchema = z.object({
  detail: z.object({
    code: z.string().regex(/^[a-z_]{1,60}$/),
    attempts: z.unknown().optional(),
  }),
});

export function readOcrAttempts(value: unknown): OcrPreprocessingAttempt[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((attempt: unknown) => {
    const result = attemptSchema.safeParse(attempt);
    if (!result.success) return [];
    const { error, ...details } = result.data;
    return [error ? { ...details, error: 'OCR pass failed.' } : details];
  });
}

const ocrErrorMessages: Readonly<Record<string, string>> = {
  ocr_busy: 'OCR inference capacity is busy.',
  ocr_not_ready: 'OCR model is not ready.',
  unsupported_language: 'The requested OCR language is unavailable.',
  invalid_image: 'The sidecar rejected the image.',
  ocr_deadline_exceeded: 'The sidecar reached its deadline.',
  ocr_failed: 'OCR inference failed.',
  ocr_timeout: 'OCR request timed out.',
  ocr_transport_error: 'The OCR response could not be read.',
  ocr_invalid_response: 'OCR sidecar returned an invalid response.',
  ocr_response_too_large: 'OCR sidecar response exceeded the size limit.',
};

export function ocrErrorMessage(code: string | null): string | undefined {
  return code && Object.hasOwn(ocrErrorMessages, code)
    ? ocrErrorMessages[code]
    : undefined;
}

interface OcrRequestParameters {
  language: string;
  minConfidence: number;
  maxImageDimension: number;
  timeoutMs: number;
}

export interface OcrSidecarTrace {
  parameters: OcrRequestParameters;
  requestBytes: number;
  httpStatus: number | null;
  responseBytes: number | null;
  durationMs: number;
  code: string | null;
  canceled: boolean;
  image: { width: number; height: number } | null;
}
