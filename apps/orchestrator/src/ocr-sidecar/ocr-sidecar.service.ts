import { Injectable } from '@nestjs/common';
import {
  readBoundedResponseBody,
  ResponseBodyLimitError,
} from '../common/bounded-response-body';
import { waitForOperation } from '../common/wait-for-operation';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { OrchestratorSettingsStore } from '../settings/orchestrator-settings-store';
import type { OcrServiceSettingsDto } from '../settings/dto/orchestrator-settings.dto';
import {
  ocrErrorMessage,
  ocrErrorSchema,
  ocrImageSchema,
  ocrReadinessSchema,
  ocrRecognitionSchema,
  readOcrAttempts,
  type OcrPreprocessingAttempt,
  type OcrSidecarRecognition,
  type OcrSidecarReadiness,
  type OcrSidecarTrace,
} from './ocr-sidecar.protocol';

const maxReadinessResponseBytes = 16 * 1024;
const maxRecognitionResponseBytes = 2 * 1024 * 1024;

type Settings = OcrServiceSettingsDto;
type Connection =
  | { status: 'disabled' }
  | { status: 'unavailable'; message: string; settings?: Settings }
  | { status: 'configured'; settings: Settings & { endpoint: string } };

type OcrReadiness =
  | Exclude<Connection, { status: 'configured' }>
  | {
      status: 'healthy' | 'unhealthy' | 'offline';
      message: string;
      settings: Settings;
      response?: Omit<OcrSidecarReadiness, 'message'>;
    };

type Recognition =
  | { status: 'disabled' }
  | {
      status: 'failed';
      error: string;
      attempts?: OcrPreprocessingAttempt[];
      trace?: OcrSidecarTrace;
    }
  | {
      status: 'available';
      value: OcrSidecarRecognition;
      trace: OcrSidecarTrace;
    };

interface HttpExchange {
  ok: boolean;
  httpStatus: number | null;
  bodyBytes: number | null;
  durationMs: number;
  failure:
    | 'canceled'
    | 'ocr_timeout'
    | 'ocr_transport_error'
    | 'ocr_response_too_large'
    | null;
  payload: unknown;
}

@Injectable()
export class OcrSidecarService {
  constructor(
    private readonly settingsStore: OrchestratorSettingsStore,
    private readonly features: FeatureFlagsService,
  ) {}

  async readiness(): Promise<OcrReadiness> {
    const connection = await this.connection();
    if (connection.status !== 'configured') return connection;

    const { settings } = connection;
    const exchange = await this.request(
      settings.endpoint + '/health',
      {},
      settings.timeoutMs,
      maxReadinessResponseBytes,
    );
    if (exchange.failure) {
      return {
        status:
          exchange.failure === 'ocr_response_too_large'
            ? 'unhealthy'
            : 'offline',
        message:
          ocrErrorMessage(exchange.failure) ?? 'OCR sidecar is unavailable.',
        settings,
      };
    }
    const parsed = ocrReadinessSchema.safeParse(exchange.payload);
    if (!parsed.success) {
      return {
        status: 'unhealthy',
        message: 'OCR sidecar returned an invalid readiness response.',
        settings,
      };
    }

    const { message, ...response } = parsed.data;
    const languageError = this.languageError(
      settings.language,
      response.language,
    );
    const ready = exchange.ok && response.ready && !languageError;
    return {
      status: ready ? 'healthy' : 'unhealthy',
      message:
        languageError ??
        (ready
          ? 'OCR sidecar is reachable.'
          : message || 'OCR sidecar is reachable but not ready.'),
      settings,
      response,
    };
  }

  async recognize(
    dataUrl: string,
    signal?: AbortSignal,
    deadline?: number,
  ): Promise<Recognition> {
    signal?.throwIfAborted();
    const opening = this.connection();
    const connection = await (signal
      ? waitForOperation(opening, signal)
      : opening);
    signal?.throwIfAborted();
    if (connection.status === 'disabled') return { status: 'disabled' };
    if (connection.status === 'unavailable') {
      return { status: 'failed', error: connection.message };
    }
    const { settings } = connection;
    const timeoutMs = Math.min(
      settings.timeoutMs,
      deadline === undefined ? Infinity : deadline - Date.now(),
    );
    if (timeoutMs <= 0) {
      return { status: 'failed', error: 'OCR request timed out.' };
    }
    const parameters = {
      language: settings.language,
      minConfidence: settings.minConfidence,
      maxImageDimension: settings.maxImageDimension,
      timeoutMs,
    };
    const body = JSON.stringify({ dataUrl, ...parameters });
    const requestTimeoutMs =
      deadline === undefined
        ? timeoutMs
        : Math.min(timeoutMs, deadline - Date.now());
    if (requestTimeoutMs <= 0) {
      return { status: 'failed', error: 'OCR request timed out.' };
    }
    const exchange = await this.request(
      settings.endpoint + '/ocr/screenshot',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      },
      requestTimeoutMs,
      maxRecognitionResponseBytes,
      signal,
    );
    const trace: OcrSidecarTrace = {
      parameters,
      requestBytes: Buffer.byteLength(body),
      httpStatus: exchange.httpStatus,
      responseBytes: exchange.bodyBytes,
      durationMs: exchange.durationMs,
      code: null,
      canceled: exchange.failure === 'canceled',
      image: null,
    };
    if (exchange.failure) {
      trace.code = exchange.failure === 'canceled' ? null : exchange.failure;
      return {
        status: 'failed',
        error: trace.canceled
          ? 'The OCR request was canceled.'
          : (ocrErrorMessage(trace.code) ?? 'OCR failed.'),
        trace,
      };
    }
    if (!exchange.ok) {
      const parsed = ocrErrorSchema.safeParse(exchange.payload);
      trace.code = parsed.success ? parsed.data.detail.code : null;
      return {
        status: 'failed',
        error:
          ocrErrorMessage(trace.code) ??
          `OCR sidecar returned HTTP ${exchange.httpStatus}.`,
        attempts: parsed.success
          ? readOcrAttempts(parsed.data.detail.attempts)
          : [],
        trace,
      };
    }
    const parsed = ocrRecognitionSchema.safeParse(exchange.payload);
    if (
      !parsed.success ||
      this.languageError(settings.language, parsed.data.language)
    ) {
      trace.code = 'ocr_invalid_response';
      return {
        status: 'failed',
        error: 'OCR sidecar returned an invalid response.',
        trace,
      };
    }
    if (
      exchange.payload &&
      typeof exchange.payload === 'object' &&
      'image' in exchange.payload
    ) {
      const image = ocrImageSchema.safeParse(exchange.payload.image);
      if (image.success) trace.image = image.data;
    }
    return { status: 'available', value: parsed.data, trace };
  }

  private async connection(): Promise<Connection> {
    if (!this.features.isEnabled('feature.ocr')) return { status: 'disabled' };
    try {
      const {
        services: { ocr },
      } = await this.settingsStore.getStoredSettings();
      if (!ocr.endpoint) {
        return {
          status: 'unavailable',
          message: 'OCR is enabled but no endpoint is configured.',
          settings: ocr,
        };
      }
      return {
        status: 'configured',
        settings: { ...ocr, endpoint: ocr.endpoint },
      };
    } catch {
      return {
        status: 'unavailable',
        message: 'OCR settings could not be loaded.',
      };
    }
  }

  private languageError(expected: string, actual: string) {
    return actual === expected
      ? undefined
      : `OCR expects ${expected}, but the sidecar serves ${actual}.`;
  }

  private async request(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    maxResponseBytes: number,
    signal?: AbortSignal,
  ): Promise<HttpExchange> {
    const timeout = AbortSignal.timeout(timeoutMs);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const started = performance.now();
    let ok = false;
    let httpStatus: number | null = null;
    let bodyBytes: number | null = null;
    let payload: unknown;
    let failure: HttpExchange['failure'] = null;
    try {
      requestSignal.throwIfAborted();
      const response = await fetch(url, { ...init, signal: requestSignal });
      ok = response.ok;
      httpStatus = response.status;
      const body = await readBoundedResponseBody(response, maxResponseBytes);
      requestSignal.throwIfAborted();
      bodyBytes = body?.bytes ?? 0;
      if (body) {
        try {
          payload = JSON.parse(body.text);
        } catch (error) {
          if (!(error instanceof SyntaxError)) throw error;
          // Each endpoint validates its own response envelope.
        }
      }
    } catch (error) {
      if (signal?.aborted) failure = 'canceled';
      else if (timeout.aborted) failure = 'ocr_timeout';
      else if (error instanceof ResponseBodyLimitError)
        failure = 'ocr_response_too_large';
      else failure = 'ocr_transport_error';
    }
    return {
      ok,
      httpStatus,
      bodyBytes,
      payload,
      failure,
      durationMs: Math.round(performance.now() - started),
    };
  }
}
