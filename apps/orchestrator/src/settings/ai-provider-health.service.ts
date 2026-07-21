import { Injectable, NotFoundException } from '@nestjs/common';
import {
  buildChatRequestBody,
  chatCompletionsEndpoint,
  providerModelsEndpoint,
} from '../common/ai-provider-request';
import { parseProviderRemoteModels } from './ai-provider-remote-models';
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
  AutomationAiProviderModelRole,
} from './contracts/ai-provider';
import type {
  AutomationAiProviderHealthDto,
  AutomationAiProviderRemoteModelDto,
} from './dto/automation-ai-provider-health.dto';
import {
  createProviderRequestScope,
  isProviderAbortError,
  providerRequestHeaders,
  readBoundedProviderText,
} from '../common/ai-provider-http';
import { MetricsService } from '../metrics/metrics.service';
import {
  aiProviderErrorMessage,
  isProviderTimeoutError,
  modelRoleLabel,
  modelRoleProbeIncompatibility,
  modelRoleProbeMessages,
} from './utils/ai-provider-health.utils';

const PROVIDER_MODEL_LIST_TIMEOUT_MS = 15_000;
const MODEL_ROLE_PROBE_TIMEOUT_MS = 60_000;

@Injectable()
export class AiProviderHealthService {
  constructor(
    private readonly metrics: MetricsService = new MetricsService(),
  ) {}

  async checkProviderHealth(
    provider: AutomationAiProvider,
    modelId?: string,
    role?: AutomationAiProviderModelRole,
  ): Promise<AutomationAiProviderHealthDto> {
    const model = modelId
      ? provider.models.find((item) => item.id === modelId)
      : (provider.models.find(
          (item) => item.enabled && (!role || item.defaultFor.includes(role)),
        ) ?? provider.models.find((item) => item.enabled));
    if (modelId && !model) {
      throw new NotFoundException(
        `AI model "${modelId}" was not found for provider "${provider.id}".`,
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
    if (model && role && !model.roles.includes(role)) {
      return this.healthResult(
        provider.id,
        model.id,
        'disabled',
        `Model is not enabled for the ${role} role.`,
      );
    }

    try {
      const response = await this.requestProvider(
        provider,
        providerModelsEndpoint(provider),
        {
          headers: providerRequestHeaders(provider),
        },
        PROVIDER_MODEL_LIST_TIMEOUT_MS,
        'models',
        role ?? 'provider',
      );
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
        parseProviderRemoteModels(provider, body).map((item) => item.id),
      );
      if (model && remoteModelIds.size > 0 && !remoteModelIds.has(model.id)) {
        return this.healthResult(
          provider.id,
          model.id,
          'error',
          `Provider is reachable, but model "${model.id}" was not listed.`,
        );
      }
      if (model && role) {
        const roleHealth = await this.exerciseModelRole(provider, model, role);
        if (roleHealth) return roleHealth;
      }
      const serverFlavor = await this.detectServerFlavor(provider);
      return this.healthResult(
        provider.id,
        model?.id,
        'ok',
        model
          ? `Provider is reachable and model "${model.id}" is available.`
          : 'Provider is reachable.',
        { serverFlavor },
      );
    } catch (error) {
      return this.healthResult(
        provider.id,
        model?.id,
        'error',
        this.providerModelListErrorMessage(error),
      );
    }
  }

  private async exerciseModelRole(
    provider: AutomationAiProvider,
    model: AutomationAiProviderModel,
    role: AutomationAiProviderModelRole,
  ) {
    try {
      const messages = modelRoleProbeMessages(role);
      const tools =
        role === 'controller'
          ? [
              {
                type: 'function',
                function: {
                  name: 'health_check_noop',
                  description:
                    'No-op tool used only to verify tool-call request compatibility.',
                  parameters: {
                    type: 'object',
                    properties: {},
                    additionalProperties: false,
                  },
                },
              },
            ]
          : undefined;
      const response = await this.requestProvider(
        provider,
        chatCompletionsEndpoint(provider),
        {
          method: 'POST',
          headers: providerRequestHeaders(provider, { json: true }),
          body: JSON.stringify(
            buildChatRequestBody({
              provider,
              model,
              messages,
              stream: false,
              tools,
            }),
          ),
        },
        MODEL_ROLE_PROBE_TIMEOUT_MS,
        'health',
        role,
      );
      if (!response.ok) {
        const detail = await readBoundedProviderText(response, 500);
        return this.healthResult(
          provider.id,
          model.id,
          'error',
          `${modelRoleLabel(role)} role check failed: HTTP ${response.status}${detail ? ` - ${detail.slice(0, 500)}` : ''}`,
        );
      }
      const body = (await response.json().catch(() => null)) as unknown;
      const incompatibility = modelRoleProbeIncompatibility(role, body);
      if (incompatibility) {
        return this.healthResult(
          provider.id,
          model.id,
          'error',
          incompatibility,
        );
      }
      return null;
    } catch (error) {
      const roleLabel = modelRoleLabel(role);
      return this.healthResult(
        provider.id,
        model.id,
        'error',
        isProviderTimeoutError(error)
          ? `${roleLabel} role check timed out after ${MODEL_ROLE_PROBE_TIMEOUT_MS / 1000}s while probing model "${model.id}". The provider may still be loading the model; retry the health check when it is ready.`
          : `${roleLabel} role check failed: ${this.errorMessage(error)}`,
      );
    }
  }

  async checkProviderConnection(provider: AutomationAiProvider) {
    try {
      const response = await this.requestProvider(
        provider,
        providerModelsEndpoint(provider),
        {
          headers: providerRequestHeaders(provider),
        },
        PROVIDER_MODEL_LIST_TIMEOUT_MS,
        'health',
        'provider',
      );
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
        this.providerModelListErrorMessage(error),
      );
    }
  }

  async listRemoteModels(
    provider: AutomationAiProvider,
  ): Promise<AutomationAiProviderRemoteModelDto[]> {
    const response = await this.requestProvider(
      provider,
      providerModelsEndpoint(provider),
      { headers: providerRequestHeaders(provider) },
      PROVIDER_MODEL_LIST_TIMEOUT_MS,
      'models',
      'provider',
    );
    if (!response.ok) {
      throw new Error(`Provider returned HTTP ${response.status}.`);
    }

    return parseProviderRemoteModels(provider, await response.json());
  }

  private providerModelListErrorMessage(error: unknown) {
    if (isProviderTimeoutError(error)) {
      return `Provider model list check timed out after ${PROVIDER_MODEL_LIST_TIMEOUT_MS / 1000}s.`;
    }

    return this.errorMessage(error);
  }

  private async detectServerFlavor(provider: AutomationAiProvider) {
    if (provider.serverFlavor && provider.serverFlavor !== 'auto') {
      return provider.serverFlavor;
    }
    const root = provider.baseUrl.replace(/\/+$/, '').replace(/\/v1$/i, '');
    const headers = providerRequestHeaders(provider);
    const lemonade = await this.tryProbe(`${root}/api/v1/health`, headers);
    if (lemonade && /lemonade/i.test(JSON.stringify(lemonade))) {
      return 'lemonade';
    }
    const llama = await this.tryProbe(`${root}/props`, headers);
    if (
      llama &&
      (Object.prototype.hasOwnProperty.call(llama, 'chat_template') ||
        Object.prototype.hasOwnProperty.call(
          llama,
          'default_generation_settings',
        ))
    ) {
      return 'llama-cpp';
    }
    const ollama = await this.tryProbe(`${root}/api/version`, headers);
    if (ollama && typeof ollama.version === 'string') return 'ollama';
    return provider.kind === 'openai' ? 'openai' : 'auto';
  }

  private async tryProbe(url: string, headers: HeadersInit) {
    const scope = createProviderRequestScope({ timeoutMs: 2_000 });
    try {
      const response = await fetch(url, { headers, signal: scope.signal });
      if (!response.ok) return null;
      const body = (await response.json().catch(() => null)) as unknown;
      return body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;
    } catch {
      return null;
    } finally {
      scope.cleanup();
    }
  }

  private async requestProvider(
    provider: AutomationAiProvider,
    url: string,
    init: RequestInit,
    timeoutMs: number,
    operation: 'health' | 'models',
    role: 'provider' | AutomationAiProviderModelRole,
  ) {
    const finishMetrics = this.metrics.beginAiProviderRequest(operation, role);
    const scope = createProviderRequestScope({ timeoutMs });
    try {
      const response = await fetch(url, { ...init, signal: scope.signal });
      finishMetrics(response.ok ? 'success' : 'error');
      return response;
    } catch (error) {
      finishMetrics(
        scope.wasTimedOut() || isProviderAbortError(error)
          ? 'timeout'
          : 'error',
      );
      throw error;
    } finally {
      scope.cleanup();
    }
  }

  errorMessage(error: unknown) {
    return aiProviderErrorMessage(error);
  }

  private healthResult(
    providerId: string,
    modelId: string | undefined,
    status: AutomationAiProviderHealthDto['status'],
    message: string,
    diagnostics?: { serverFlavor?: string },
  ): AutomationAiProviderHealthDto {
    return {
      providerId,
      ...(modelId ? { modelId } : {}),
      status,
      message,
      checkedAt: new Date().toISOString(),
      ...(diagnostics?.serverFlavor
        ? { serverFlavor: diagnostics.serverFlavor }
        : {}),
    };
  }
}
