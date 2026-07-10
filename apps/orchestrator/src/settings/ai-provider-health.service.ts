import { Injectable, NotFoundException } from '@nestjs/common';
import {
  buildChatRequestBody,
  chatCompletionsEndpoint,
  type ChatMessage,
} from '@rebroid/ai-core/harness';
import {
  parseProviderRemoteModels,
  providerModelsUrl,
  providerRemoteModelsUrl,
  type AutomationAiProvider,
  type AutomationAiProviderModel,
  type AutomationAiProviderModelRole,
} from '@rebroid/ai-core/provider';
import type {
  AutomationAiProviderHealthDto,
  AutomationAiProviderRemoteModelDto,
} from './dto/automation-ai-provider.dto';
import {
  createProviderRequestScope,
  isProviderAbortError,
  providerRequestHeaders,
  readBoundedProviderText,
} from '@rebroid/ai-core/provider-http';
import { MetricsService } from '../metrics/metrics.service';

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
        providerModelsUrl(provider),
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
      const messages = this.roleProbeMessages(role);
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
          `${this.roleLabel(role)} role check failed: HTTP ${response.status}${detail ? ` - ${detail.slice(0, 500)}` : ''}`,
        );
      }
      const body = (await response.json().catch(() => null)) as unknown;
      const incompatibility = this.roleProbeIncompatibility(role, body);
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
      const roleLabel = this.roleLabel(role);
      return this.healthResult(
        provider.id,
        model.id,
        'error',
        this.isTimeoutError(error)
          ? `${roleLabel} role check timed out after ${MODEL_ROLE_PROBE_TIMEOUT_MS / 1000}s while probing model "${model.id}". The provider may still be loading the model; retry the health check when it is ready.`
          : `${roleLabel} role check failed: ${this.errorMessage(error)}`,
      );
    }
  }

  private roleProbeMessages(
    role: AutomationAiProviderModelRole,
  ): ChatMessage[] {
    if (role === 'vision') {
      return [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Reply with the single word white if the attached pixel is white.',
            },
            {
              type: 'image_url',
              image_url: {
                url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
              },
            },
          ],
        },
      ];
    }
    if (role === 'controller') {
      return [
        {
          role: 'user',
          content: 'Call health_check_noop now. Do not answer with prose.',
        },
      ];
    }
    return [{ role: 'user', content: 'Reply with ok.' }];
  }

  async checkProviderConnection(provider: AutomationAiProvider) {
    try {
      const response = await this.requestProvider(
        provider,
        providerModelsUrl(provider),
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
      providerRemoteModelsUrl(provider),
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
    if (this.isTimeoutError(error)) {
      return `Provider model list check timed out after ${PROVIDER_MODEL_LIST_TIMEOUT_MS / 1000}s.`;
    }

    return this.errorMessage(error);
  }

  private roleProbeIncompatibility(
    role: AutomationAiProviderModelRole,
    body: unknown,
  ) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return `${this.roleLabel(role)} role check returned an invalid JSON body.`;
    }
    const root = body as Record<string, unknown>;
    const choice = Array.isArray(root.choices) ? root.choices[0] : null;
    const choiceRecord = this.record(choice);
    const message =
      this.record(choiceRecord?.message) ?? this.record(root.message);
    if (!message) {
      return `${this.roleLabel(role)} role check returned no assistant message.`;
    }
    if (role === 'controller') {
      const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
      const hasExpectedCall = calls.some((call) => {
        const callRecord = this.record(call);
        const functionRecord = this.record(callRecord?.function);
        return functionRecord?.name === 'health_check_noop';
      });
      return hasExpectedCall
        ? null
        : 'Controller role check did not produce the required structured tool call.';
    }
    const content =
      typeof message.content === 'string' ? message.content.trim() : '';
    if (!content) {
      const reasoning =
        typeof message.reasoning_content === 'string'
          ? message.reasoning_content.trim()
          : typeof message.thinking === 'string'
            ? message.thinking.trim()
            : '';
      return reasoning
        ? `${this.roleLabel(role)} role check returned reasoning but no public content.`
        : `${this.roleLabel(role)} role check returned empty content.`;
    }
    if (role === 'vision' && !/white/i.test(content)) {
      return 'Vision role check did not identify the supplied white image.';
    }
    return null;
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
      return this.record(body);
    } catch {
      return null;
    } finally {
      scope.cleanup();
    }
  }

  private roleLabel(role: AutomationAiProviderModelRole) {
    if (role === 'controller') return 'Controller';
    if (role === 'planner') return 'Planner';
    return 'Vision';
  }

  private record(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
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

  private isTimeoutError(error: unknown) {
    if (!(error instanceof Error)) return false;

    return (
      error.name === 'TimeoutError' ||
      error.name === 'AbortError' ||
      /aborted due to timeout/i.test(error.message)
    );
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
