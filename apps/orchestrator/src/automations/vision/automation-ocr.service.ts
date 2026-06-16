import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createDetection,
  type VisionDetection,
} from '@rebroid/vision-core/observation';
import { sanitizeAiText } from '../ai/automation-ai-observation.utils';
import type { OptimizedAiScreenshot } from '../ai/automation-ai-screenshot.utils';

export interface AutomationOcrResult {
  status: 'available' | 'disabled' | 'failed';
  detections: VisionDetection[];
  elapsedMs?: number;
  engine?: string;
  model?: string;
  languages?: string[];
  preprocessingMode?: string;
  preprocessingAttempts?: OcrPreprocessingAttempt[];
  error?: string;
}

export interface OcrPreprocessingAttempt {
  mode: string;
  status: string;
  textBoxCount?: number;
  averageConfidence?: number;
  elapsedMs?: number;
  error?: string;
}

interface OcrSidecarDetection {
  id?: string;
  text?: string;
  label?: string;
  confidence?: number;
  bounds?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

interface OcrSidecarResponse {
  status?: string;
  detections?: OcrSidecarDetection[];
  elapsedMs?: number;
  engine?: string;
  model?: string;
  languages?: string[];
  preprocessingMode?: string;
  preprocessingAttempts?: OcrPreprocessingAttempt[];
}

@Injectable()
export class AutomationOcrService {
  constructor(private readonly config: ConfigService) {}

  async recognize(
    image: OptimizedAiScreenshot,
    abortSignal?: AbortSignal,
  ): Promise<AutomationOcrResult> {
    const enabled = this.config.get<boolean>('app.ocr.enabled') ?? false;
    const baseUrl = this.config.get<string>('app.ocr.baseUrl') ?? '';
    if (!enabled || !baseUrl) {
      return { status: 'disabled', detections: [] };
    }

    const timeoutMs = this.config.get<number>('app.ocr.timeoutMs') ?? 15_000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    abortSignal?.addEventListener('abort', onAbort, { once: true });
    try {
      const response = await fetch(`${baseUrl}/ocr/screenshot`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          dataUrl: image.dataUrl,
          languages: this.config.get<string[]>('app.ocr.languages') ?? ['en'],
          minConfidence:
            this.config.get<number>('app.ocr.minConfidence') ?? 0.4,
          maxImageDimension:
            this.config.get<number>('app.ocr.maxImageDimension') ?? 1600,
          preprocessingModes: this.config.get<string[]>(
            'app.ocr.preprocessingModes',
          ) ?? ['raw', 'grayscale', 'contrast', 'threshold'],
        }),
        signal: controller.signal,
      });
      const text = await response.text();
      const payload = this.parsePayload(text);
      if (!response.ok) {
        return {
          status: 'failed',
          detections: [],
          error: sanitizeAiText(
            this.errorDetail(payload?.detail) ??
              payload?.message ??
              `OCR sidecar returned ${response.status}.`,
            1000,
          ),
          preprocessingAttempts: this.normalizeAttempts(
            this.errorAttempts(payload?.detail) ??
              payload?.preprocessingAttempts,
          ),
        };
      }
      return this.normalizePayload(payload);
    } catch (error) {
      return {
        status: 'failed',
        detections: [],
        error: sanitizeAiText(
          error instanceof Error ? error.message : String(error),
          1000,
        ),
      };
    } finally {
      clearTimeout(timeout);
      abortSignal?.removeEventListener('abort', onAbort);
    }
  }

  private parsePayload(text: string):
    | (OcrSidecarResponse & {
        detail?: { message?: string; attempts?: unknown } | string;
        message?: string;
      })
    | null {
    try {
      return text ? (JSON.parse(text) as OcrSidecarResponse) : null;
    } catch {
      return { message: text };
    }
  }

  private normalizePayload(
    payload: OcrSidecarResponse | null,
  ): AutomationOcrResult {
    const detections = (payload?.detections ?? [])
      .map((detection, index) => {
        const label = detection.label ?? detection.text;
        if (!label || !detection.bounds) {
          return null;
        }
        return createDetection({
          id: detection.id ?? `ocr-${index + 1}`,
          label,
          text: detection.text ?? label,
          confidence: detection.confidence ?? 0.5,
          bounds: detection.bounds,
          source: 'ocr',
        });
      })
      .filter((detection): detection is VisionDetection => detection !== null);
    return {
      status: 'available',
      detections,
      ...(payload?.elapsedMs !== undefined
        ? { elapsedMs: payload.elapsedMs }
        : {}),
      ...(payload?.engine ? { engine: payload.engine } : {}),
      ...(payload?.model ? { model: payload.model } : {}),
      ...(payload?.languages ? { languages: payload.languages } : {}),
      ...(payload?.preprocessingMode
        ? { preprocessingMode: payload.preprocessingMode }
        : {}),
      ...(payload?.preprocessingAttempts
        ? {
            preprocessingAttempts: this.normalizeAttempts(
              payload.preprocessingAttempts,
            ),
          }
        : {}),
    };
  }

  private errorDetail(
    detail: { message?: string; attempts?: unknown } | string | undefined,
  ) {
    if (!detail) return undefined;
    if (typeof detail === 'string') return detail;
    return detail.message;
  }

  private errorAttempts(
    detail: { message?: string; attempts?: unknown } | string | undefined,
  ) {
    if (!detail || typeof detail === 'string') return undefined;
    return detail.attempts;
  }

  private normalizeAttempts(value: unknown): OcrPreprocessingAttempt[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((attempt) => {
        if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt)) {
          return null;
        }
        const raw = attempt as Record<string, unknown>;
        const mode = typeof raw.mode === 'string' ? raw.mode : '';
        const status = typeof raw.status === 'string' ? raw.status : '';
        if (!mode || !status) return null;
        return {
          mode,
          status,
          ...(typeof raw.textBoxCount === 'number'
            ? { textBoxCount: raw.textBoxCount }
            : {}),
          ...(typeof raw.averageConfidence === 'number'
            ? { averageConfidence: raw.averageConfidence }
            : {}),
          ...(typeof raw.elapsedMs === 'number'
            ? { elapsedMs: raw.elapsedMs }
            : {}),
          ...(typeof raw.error === 'string'
            ? { error: sanitizeAiText(raw.error, 500) }
            : {}),
        };
      })
      .filter(
        (attempt): attempt is OcrPreprocessingAttempt => attempt !== null,
      );
  }
}
