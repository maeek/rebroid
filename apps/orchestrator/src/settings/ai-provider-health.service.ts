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

const PROVIDER_MODEL_LIST_TIMEOUT_MS = 15_000;
const MODEL_ROLE_PROBE_TIMEOUT_MS = 60_000;

@Injectable()
export class AiProviderHealthService {
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
      const response = await fetch(providerModelsUrl(provider), {
        headers: provider.apiKey
          ? { Authorization: `Bearer ${provider.apiKey}` }
          : undefined,
        signal: AbortSignal.timeout(PROVIDER_MODEL_LIST_TIMEOUT_MS),
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
      if (model && role) {
        const roleHealth = await this.exerciseModelRole(provider, model, role);
        if (roleHealth) return roleHealth;
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
        role === 'planner'
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
      const response = await fetch(chatCompletionsEndpoint(provider), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(provider.apiKey
            ? { Authorization: `Bearer ${provider.apiKey}` }
            : {}),
        },
        signal: AbortSignal.timeout(MODEL_ROLE_PROBE_TIMEOUT_MS),
        body: JSON.stringify(
          buildChatRequestBody({
            provider,
            model,
            messages,
            stream: false,
            tools,
          }),
        ),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        return this.healthResult(
          provider.id,
          model.id,
          'error',
          `${role === 'planner' ? 'Planner' : 'Vision'} role check failed: HTTP ${response.status}${detail ? ` - ${detail.slice(0, 500)}` : ''}`,
        );
      }
      return null;
    } catch (error) {
      const roleLabel = role === 'planner' ? 'Planner' : 'Vision';
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
            { type: 'text', text: 'Reply with ok if you can read this image.' },
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
    return [{ role: 'user', content: 'Reply with ok.' }];
  }

  async checkProviderConnection(provider: AutomationAiProvider) {
    try {
      const response = await fetch(providerModelsUrl(provider), {
        headers: provider.apiKey
          ? { Authorization: `Bearer ${provider.apiKey}` }
          : undefined,
        signal: AbortSignal.timeout(PROVIDER_MODEL_LIST_TIMEOUT_MS),
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
        this.providerModelListErrorMessage(error),
      );
    }
  }

  async listRemoteModels(
    provider: AutomationAiProvider,
  ): Promise<AutomationAiProviderRemoteModelDto[]> {
    const response = await fetch(providerRemoteModelsUrl(provider), {
      headers: provider.apiKey
        ? { Authorization: `Bearer ${provider.apiKey}` }
        : undefined,
      signal: AbortSignal.timeout(PROVIDER_MODEL_LIST_TIMEOUT_MS),
    });
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
