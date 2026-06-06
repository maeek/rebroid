import { Injectable, NotFoundException } from '@nestjs/common';
import type { AutomationAiProvider } from '../automations/ai/automation-ai.types';
import type { AutomationAiProviderHealthDto } from './dto/automation-ai-provider.dto';

@Injectable()
export class AiProviderHealthService {
  async checkProviderHealth(
    provider: AutomationAiProvider,
    modelId?: string,
  ): Promise<AutomationAiProviderHealthDto> {
    const model = modelId
      ? provider.models.find((item) => item.id === modelId)
      : (provider.models.find((item) => item.enabled && item.default) ??
        provider.models.find((item) => item.enabled));
    if (modelId && !model) {
      throw new NotFoundException(
        `AI model "${modelId}" was not found for provider "${provider.id}".`,
      );
    }
    if (!provider.enabled) {
      return this.healthResult(
        provider.id,
        model?.id,
        'disabled',
        'Provider is disabled.',
      );
    }
    if (model && !model.enabled) {
      return this.healthResult(
        provider.id,
        model.id,
        'disabled',
        'Model is disabled.',
      );
    }

    try {
      const response = await fetch(this.modelsUrl(provider), {
        headers: provider.apiKey
          ? { Authorization: `Bearer ${provider.apiKey}` }
          : undefined,
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        return this.healthResult(
          provider.id,
          model?.id,
          'error',
          `Provider returned HTTP ${response.status}.`,
        );
      }
      const body = (await response.json().catch(() => null)) as {
        data?: Array<{ id?: unknown }>;
      } | null;
      const remoteModelIds = new Set(
        Array.isArray(body?.data)
          ? body.data
              .map((item) => (typeof item.id === 'string' ? item.id : ''))
              .filter(Boolean)
          : [],
      );
      if (model && remoteModelIds.size > 0 && !remoteModelIds.has(model.id)) {
        return this.healthResult(
          provider.id,
          model.id,
          'error',
          `Provider is reachable, but model "${model.id}" was not listed.`,
        );
      }
      return this.healthResult(
        provider.id,
        model?.id,
        'ok',
        model
          ? `Provider is reachable and model "${model.id}" is available.`
          : 'Provider is reachable.',
      );
    } catch (error) {
      return this.healthResult(
        provider.id,
        model?.id,
        'error',
        this.errorMessage(error),
      );
    }
  }

  async checkProviderConnection(provider: AutomationAiProvider) {
    try {
      const response = await fetch(this.modelsUrl(provider), {
        headers: provider.apiKey
          ? { Authorization: `Bearer ${provider.apiKey}` }
          : undefined,
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        return this.healthResult(
          provider.id,
          undefined,
          'error',
          `Provider returned HTTP ${response.status}.`,
        );
      }
      return this.healthResult(
        provider.id,
        undefined,
        'ok',
        'Provider connection is reachable.',
      );
    } catch (error) {
      return this.healthResult(
        provider.id,
        undefined,
        'error',
        this.errorMessage(error),
      );
    }
  }

  errorMessage(error: unknown) {
    if (!(error instanceof Error)) return 'Provider health check failed.';

    const cause = error.cause;
    if (!cause || typeof cause !== 'object') return error.message;

    const causeRecord = cause as {
      address?: unknown;
      code?: unknown;
      message?: unknown;
      port?: unknown;
    };
    const details = [
      typeof causeRecord.message === 'string' ? causeRecord.message : '',
      typeof causeRecord.code === 'string' ? causeRecord.code : '',
      typeof causeRecord.address === 'string' ? causeRecord.address : '',
      typeof causeRecord.port === 'number' ? String(causeRecord.port) : '',
    ].filter(Boolean);
    const uniqueDetails = Array.from(new Set(details));

    return uniqueDetails.length > 0
      ? `${error.message}: ${uniqueDetails.join(' ')}`
      : error.message;
  }

  private modelsUrl(provider: AutomationAiProvider) {
    if (provider.kind === 'ollama') {
      return `${provider.baseUrl.replace(/\/+$/, '')}/v1/models`;
    }
    return `${provider.baseUrl.replace(/\/+$/, '')}/models`;
  }

  private healthResult(
    providerId: string,
    modelId: string | undefined,
    status: AutomationAiProviderHealthDto['status'],
    message: string,
  ): AutomationAiProviderHealthDto {
    return {
      providerId,
      ...(modelId ? { modelId } : {}),
      status,
      message,
      checkedAt: new Date().toISOString(),
    };
  }
}
