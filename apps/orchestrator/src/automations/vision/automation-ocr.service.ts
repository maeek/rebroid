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
            payload?.detail ??
              payload?.message ??
              `OCR sidecar returned ${response.status}.`,
            1000,
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

  private parsePayload(
    text: string,
  ): (OcrSidecarResponse & { detail?: string; message?: string }) | null {
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
    };
  }
}
