import { Injectable, NotFoundException } from '@nestjs/common';
import {
  withProviderChatResponse,
  deviceControllerResponseMode,
  isOfficialOpenAiProvider,
  modelSupportsTools,
  providerModelsEndpoint,
} from '../common/ai-provider-request';
import {
  consumeChatCompletionStream,
  providerStreamFormat,
} from '../common/ai-provider-stream';
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
  withProviderResponse,
  readProviderJson,
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
    const eligibleModels = provider.models.filter(
      (item) => item.enabled && (!role || item.roles.includes(role)),
    );
    const model = modelId
      ? provider.models.find((item) => item.id === modelId)
      : (eligibleModels.find(
          (item) => !role || item.defaultFor.includes(role),
        ) ?? eligibleModels[0]);
    if (modelId && !model) {
      throw new NotFoundException(
        `AI model "${modelId}" was not found for provider "${provider.id}".`,
      );
    }
    if (!model && role) {
      return this.healthResult(
        provider.id,
        undefined,
        'disabled',
        `No enabled model is configured for the ${role} role.`,
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
      const response = await this.requestModels(
        provider,
        'models',
        role ?? 'provider',
        readProviderJson,
      );
      if (!response.ok) {
        return this.healthResult(
          provider.id,
          model?.id,
          'error',
          `Provider returned HTTP ${response.status}.`,
        );
      }
      const remoteModelIds = new Set(
        parseProviderRemoteModels(provider, response.body).map(
          (item) => item.id,
        ),
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
      let mode: 'schema' | 'tool' | 'text' | null = 'text';
      if (role === 'controller') mode = deviceControllerResponseMode(model);
      else if (role === 'planner' && modelSupportsTools(model)) mode = 'tool';
      if (!mode) {
        return this.healthResult(
          provider.id,
          model.id,
          'error',
          'The controller model requires structured output or tool calling.',
        );
      }
      const stream = role !== 'vision';
      const messages = modelRoleProbeMessages(role, mode);
      const tools =
        mode === 'tool'
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
      const response = await this.measureRequest('health', role, () =>
        withProviderChatResponse(
          {
            provider,
            model,
            messages,
            tools,
            stream,
            ...(mode === 'schema'
              ? {
                  responseFormat: {
                    type: 'json_schema' as const,
                    schema: {
                      type: 'object',
                      properties: { ok: { type: 'boolean' } },
                      required: ['ok'],
                      additionalProperties: false,
                    },
                  },
                }
              : {}),
          },
          { timeoutMs: MODEL_ROLE_PROBE_TIMEOUT_MS },
          async (response) => ({
            ok: response.ok,
            status: response.status,
            body: response.ok
              ? await readProbeBody(response, stream, provider)
              : null,
            detail: response.ok
              ? ''
              : await readBoundedProviderText(response, 500),
          }),
        ),
      );
      if (!response.ok) {
        const detail = response.detail;
        return this.healthResult(
          provider.id,
          model.id,
          'error',
          `${modelRoleLabel(role)} role check failed: HTTP ${response.status}${detail ? ` - ${detail.slice(0, 500)}` : ''}`,
        );
      }
      const incompatibility = modelRoleProbeIncompatibility(
        role,
        response.body,
        mode,
      );
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

  async checkProviderConnection(
    provider: AutomationAiProvider,
    verifyConfiguredModels = false,
  ) {
    try {
      const requiredModels =
        verifyConfiguredModels && isOfficialOpenAiProvider(provider)
          ? provider.models.filter((model) => model.enabled)
          : [];
      const response = await this.requestModels(
        provider,
        'health',
        'provider',
        async (response) => {
          if (response.ok && requiredModels.length > 0) {
            return parseProviderRemoteModels(
              provider,
              await readProviderJson(response, { strict: true }),
            );
          }
          await response.body?.cancel();
          return [];
        },
      );
      if (!response.ok) {
        return this.healthResult(
          provider.id,
          undefined,
          'error',
          `Provider returned HTTP ${response.status}.`,
        );
      }
      const available = new Set(response.body.map((model) => model.id));
      const missing = requiredModels.find((model) => !available.has(model.id));
      if (missing) {
        return this.healthResult(
          provider.id,
          undefined,
          'error',
          `This OpenAI project does not list ${missing.id}. Turn off the starter model to connect and choose a different model.`,
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
    const response = await this.requestModels(
      provider,
      'models',
      'provider',
      (response) => readProviderJson(response, { strict: true }),
    );
    if (!response.ok) {
      throw new Error(`Provider returned HTTP ${response.status}.`);
    }

    return parseProviderRemoteModels(provider, response.body);
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
    try {
      return await withProviderResponse(
        url,
        { headers },
        { timeoutMs: 2_000 },
        async (response) => {
          if (!response.ok) {
            await response.body?.cancel();
            return null;
          }
          const body = await readProviderJson(response);
          return body && typeof body === 'object' && !Array.isArray(body)
            ? (body as Record<string, unknown>)
            : null;
        },
      );
    } catch {
      return null;
    }
  }

  private requestModels<T>(
    provider: AutomationAiProvider,
    operation: 'health' | 'models',
    role: 'provider' | AutomationAiProviderModelRole,
    consume: (response: Response) => Promise<T>,
  ) {
    return this.measureRequest(operation, role, () =>
      withProviderResponse(
        providerModelsEndpoint(provider),
        { headers: providerRequestHeaders(provider) },
        { timeoutMs: PROVIDER_MODEL_LIST_TIMEOUT_MS },
        async (response) => {
          if (!response.ok) {
            await response.body?.cancel();
            return { ok: false as const, status: response.status };
          }
          return { ok: true as const, body: await consume(response) };
        },
      ),
    );
  }

  private async measureRequest<T extends { ok: boolean }>(
    operation: 'health' | 'models',
    role: 'provider' | AutomationAiProviderModelRole,
    request: () => Promise<T>,
  ) {
    const finishMetrics = this.metrics.beginAiProviderRequest(operation, role);
    try {
      const result = await request();
      finishMetrics(result.ok ? 'success' : 'error');
      return result;
    } catch (error) {
      finishMetrics(isProviderTimeoutError(error) ? 'timeout' : 'error');
      throw error;
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

const readProbeBody = async (
  response: Response,
  stream: boolean,
  provider: AutomationAiProvider,
) => {
  if (!stream) return readProviderJson(response);
  if (!response.body) return null;
  const result = await consumeChatCompletionStream({
    body: response.body,
    format: providerStreamFormat(provider),
    officialOpenAi: isOfficialOpenAiProvider(provider),
  });
  return { message: result.message };
};
