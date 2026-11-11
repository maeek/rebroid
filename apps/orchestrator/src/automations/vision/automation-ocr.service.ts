import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { createDetection, type VisionDetection } from './vision-observation';
import { OrchestratorSettingsStore } from '../../settings/orchestrator-settings-store';
import { sanitizeAiText } from '../ai/automation-ai-observation.utils';
import type { AiScreenshot } from '../ai/automation-ai-screenshot.utils';
import type {
  AutomationOcrPort,
  AutomationOcrResult,
  OcrPreprocessingAttempt,
} from './automation-ocr.port';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';

const normalizedCoordinate = z.number().finite().min(0).max(1);
const ocrSuccessSchema = z.object({
  status: z.literal('available'),
  detections: z.array(
    z
      .object({
        id: z.string().optional(),
        text: z.string().optional(),
        label: z.string().optional(),
        confidence: normalizedCoordinate.optional(),
        bounds: z.object({
          left: normalizedCoordinate,
          top: normalizedCoordinate,
          width: normalizedCoordinate,
          height: normalizedCoordinate,
        }),
      })
      .refine((detection) =>
        Boolean((detection.label ?? detection.text)?.trim()),
      ),
  ),
  elapsedMs: z.number().finite().nonnegative().optional(),
  engine: z.string().optional(),
  model: z.string().optional(),
  language: z.string().optional(),
  preprocessingMode: z.string().optional(),
  preprocessingAttempts: z.unknown().optional(),
});

type OcrSidecarResponse = z.infer<typeof ocrSuccessSchema>;

@Injectable()
export class AutomationOcrService implements AutomationOcrPort {
  constructor(
    private readonly settingsStore: OrchestratorSettingsStore,
    private readonly features: FeatureFlagsService,
  ) {}

  async recognize(
    image: AiScreenshot,
    abortSignal?: AbortSignal,
  ): Promise<AutomationOcrResult> {
    abortSignal?.throwIfAborted();
    const settings = (await this.settingsStore.getStoredSettings()).services
      .ocr;
    const baseUrl = settings.endpoint ?? '';
    if (!this.features.isEnabled('feature.ocr') || !baseUrl) {
      return { status: 'disabled', detections: [] };
    }

    abortSignal?.throwIfAborted();
    const timeoutMs = settings.timeoutMs;
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
          language: settings.language,
          minConfidence: settings.minConfidence,
          maxImageDimension: settings.maxImageDimension,
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
      const success = ocrSuccessSchema.safeParse(payload);
      if (
        !success.success ||
        (success.data.language !== undefined &&
          success.data.language !== settings.language)
      ) {
        return {
          status: 'failed',
          detections: [],
          error: 'OCR sidecar returned an invalid response.',
        };
      }
      return this.normalizePayload(success.data);
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
    | (Partial<OcrSidecarResponse> & {
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
      ...(payload?.language ? { language: payload.language } : {}),
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
          ...(typeof raw.qualityScore === 'number'
            ? { qualityScore: raw.qualityScore }
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
