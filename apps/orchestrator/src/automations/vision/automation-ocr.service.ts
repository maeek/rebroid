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
import {
  projectOcrResponse,
  type AutomationOcrExchange,
} from './automation-ocr-exchange';

const normalizedCoordinate = z.number().finite().min(0).max(1);
const ocrImageSchema = z.object({
  width: z.number().int().min(1).max(4096),
  height: z.number().int().min(1).max(4096),
});
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
    deadline?: number,
    onExchange?: (exchange: AutomationOcrExchange) => Promise<void>,
  ): Promise<AutomationOcrResult> {
    abortSignal?.throwIfAborted();
    const settings = (await this.settingsStore.getStoredSettings()).services
      .ocr;
    const baseUrl = settings.endpoint ?? '';
    if (!this.features.isEnabled('feature.ocr')) {
      return { status: 'disabled', detections: [] };
    }
    if (!baseUrl) {
      return {
        status: 'failed',
        detections: [],
        error: 'OCR is enabled but no endpoint is configured.',
      };
    }

    abortSignal?.throwIfAborted();
    const timeoutMs = Math.min(
      settings.timeoutMs,
      deadline === undefined ? Infinity : deadline - Date.now(),
    );
    if (timeoutMs <= 0) {
      return {
        status: 'failed',
        detections: [],
        error: 'OCR request timed out.',
      };
    }
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = abortSignal
      ? AbortSignal.any([abortSignal, timeout])
      : timeout;
    const parameters = {
      language: settings.language,
      minConfidence: settings.minConfidence,
      maxImageDimension: settings.maxImageDimension,
      timeoutMs,
    };
    const body = JSON.stringify({ dataUrl: image.dataUrl, ...parameters });
    const started = performance.now();
    let result: AutomationOcrResult | undefined;
    let httpStatus: number | null = null;
    let responseBytes: number | null = null;
    let responseImage: AutomationOcrExchange['response']['image'] = null;
    let code: string | null = null;
    let canceled = false;
    try {
      const response = await fetch(`${baseUrl}/ocr/screenshot`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal,
      });
      httpStatus = response.status;
      const text = await response.text();
      if (onExchange) responseBytes = Buffer.byteLength(text);
      const payload = this.parsePayload(text);
      if (!response.ok) {
        const detail = payload?.detail;
        const returnedCode =
          detail && typeof detail === 'object' ? detail.code : null;
        if (
          typeof returnedCode === 'string' &&
          /^[a-z_]{1,60}$/.test(returnedCode)
        )
          code = returnedCode;
        result = {
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
        return result;
      }
      const success = ocrSuccessSchema.safeParse(payload);
      if (
        !success.success ||
        (success.data.language !== undefined &&
          success.data.language !== settings.language)
      ) {
        code = 'ocr_invalid_response';
        result = {
          status: 'failed',
          detections: [],
          error: 'OCR sidecar returned an invalid response.',
        };
        return result;
      }
      const returnedImage = ocrImageSchema.safeParse(payload?.image);
      if (returnedImage.success) responseImage = returnedImage.data;
      result = this.normalizePayload(success.data);
      return result;
    } catch (error) {
      canceled = abortSignal?.aborted === true;
      code = timeout.aborted ? 'ocr_timeout' : 'ocr_transport_error';
      result = {
        status: 'failed',
        detections: [],
        error: timeout.aborted
          ? 'OCR request timed out.'
          : sanitizeAiText(
              error instanceof Error ? error.message : String(error),
              1000,
            ),
      };
      abortSignal?.throwIfAborted();
      return result;
    } finally {
      if (result && onExchange) {
        await onExchange({
          request: {
            method: 'POST',
            path: '/ocr/screenshot',
            image: {
              mimeType: image.mimeType,
              capturedAt: image.capturedAt,
              dataUrlBytes:
                typeof image.dataUrl === 'string'
                  ? Buffer.byteLength(image.dataUrl)
                  : 0,
            },
            bodyBytes: Buffer.byteLength(body),
            ...parameters,
          },
          response: projectOcrResponse(
            result,
            {
              httpStatus,
              code,
              bodyBytes: responseBytes,
              image: responseImage,
              durationMs: Math.round(performance.now() - started),
            },
            canceled,
          ),
        });
      }
    }
  }

  private parsePayload(text: string):
    | (Partial<OcrSidecarResponse> & {
        detail?:
          { message?: string; attempts?: unknown; code?: unknown } | string;
        message?: string;
        image?: unknown;
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
