import { Injectable } from '@nestjs/common';
import { OrchestratorSettingsStore } from '../settings/orchestrator-settings-store';
import type { ServiceHealthDto } from './dto/health-response.dto';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

type OcrHealthPayload = {
  ok?: boolean;
  status?: string;
  service?: string;
  engine?: string;
  language?: string;
  preprocessingModes?: string[];
  ready?: boolean;
  message?: string;
};

@Injectable()
export class OcrSidecarHealthService {
  constructor(
    private readonly settingsStore: OrchestratorSettingsStore,
    private readonly features: FeatureFlagsService,
  ) {}

  async health(): Promise<ServiceHealthDto> {
    const settings = (await this.settingsStore.getStoredSettings()).services
      .ocr;
    const details = {
      enabled: this.features.isEnabled('feature.ocr'),
      endpoint: settings.endpoint,
      timeoutMs: settings.timeoutMs,
      maxImageDimension: settings.maxImageDimension,
      minConfidence: settings.minConfidence,
      language: settings.language,
    };

    if (!details.enabled) {
      return {
        ok: true,
        status: 'disabled',
        message: 'OCR sidecar integration is disabled.',
        details,
      };
    }

    if (!settings.endpoint) {
      return {
        ok: false,
        status: 'unhealthy',
        message: 'OCR sidecar is enabled but no endpoint is configured.',
        details,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), settings.timeoutMs);
    try {
      const response = await fetch(`${settings.endpoint}/health`, {
        signal: controller.signal,
      });
      const body = (await response
        .json()
        .catch(() => ({}))) as OcrHealthPayload;
      if (!response.ok) {
        return {
          ok: false,
          status: 'unhealthy',
          message:
            body.message || `OCR sidecar returned HTTP ${response.status}.`,
          details: { ...details, response: this.sanitizePayload(body) },
        };
      }

      const languageMatches = body.language === settings.language;
      const ready = body.ready === true && languageMatches;
      let message = body.message || 'OCR sidecar is reachable but not ready.';
      if (!body.language)
        message = 'OCR sidecar did not report its deployed language.';
      else if (!languageMatches)
        message = `OCR expects ${settings.language}, but the sidecar serves ${body.language}.`;
      else if (ready) message = 'OCR sidecar is reachable.';
      return {
        ok: ready,
        status: ready ? 'healthy' : 'unhealthy',
        message,
        details: { ...details, response: this.sanitizePayload(body) },
      };
    } catch (error) {
      return {
        ok: false,
        status: 'offline',
        message:
          error instanceof Error
            ? error.message
            : 'OCR sidecar is unavailable.',
        details,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private sanitizePayload(payload: OcrHealthPayload) {
    return {
      ok: payload.ok,
      status: payload.status,
      service: payload.service,
      engine: payload.engine,
      language: payload.language,
      preprocessingModes: payload.preprocessingModes,
      ready: payload.ready,
    };
  }
}
