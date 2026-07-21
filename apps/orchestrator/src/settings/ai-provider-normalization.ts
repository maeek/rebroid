import { defaultAiProviders, MASKED_API_KEY } from './ai-provider-defaults';
import { modelRoles, normalizeDefaultModel } from './ai-provider-default-model';
import {
  nullableInteger,
  nullableNumber,
  nullableText,
  text,
} from './ai-provider-values';
import {
  AiProviderConfigurationError,
  type AutomationAiProvider,
  type AutomationAiProviderModel,
  type AutomationAiProviderModelCapabilities,
  type AutomationAiProviderModelRole,
  type AutomationAiProviderProtocol,
  type AutomationAiProviderServerFlavor,
  type AutomationAiThinkingMode,
} from './contracts/ai-provider';

const providerProtocols = [
  'openai-chat-completions',
  'ollama-native-chat',
] as const satisfies readonly AutomationAiProviderProtocol[];
const providerServerFlavors = [
  'auto',
  'openai',
  'llama-cpp',
  'lemonade',
  'ollama',
] as const satisfies readonly AutomationAiProviderServerFlavor[];
const thinkingModes = [
  'disabled',
  'bounded',
  'provider-default',
] as const satisfies readonly AutomationAiThinkingMode[];

export const normalizeAiProviders = (value: unknown) => {
  if (!Array.isArray(value)) {
    return defaultAiProviders();
  }
  const seen = new Set<string>();
  const providers: AutomationAiProvider[] = [];
  for (const rawProvider of value) {
    let normalized: AutomationAiProvider;
    try {
      normalized = normalizeAiProvider(rawProvider);
    } catch {
      continue;
    }
    if (!normalized || seen.has(normalized.id)) {
      continue;
    }
    seen.add(normalized.id);
    providers.push(normalized);
  }
  return providers;
};

export const normalizeAiProvider = (
  rawProvider: unknown,
  fallback?: AutomationAiProvider,
): AutomationAiProvider => {
  if (
    !rawProvider ||
    typeof rawProvider !== 'object' ||
    Array.isArray(rawProvider)
  ) {
    throw new AiProviderConfigurationError('AI provider must be an object.');
  }
  const provider = rawProvider as Record<string, unknown>;
  const id = text(provider.id) || fallback?.id || '';
  const label = text(provider.label) || fallback?.label || id;
  const kind = text(provider.kind) || fallback?.kind || '';
  const protocol = normalizedEnum(
    provider.protocol,
    providerProtocols,
    fallback?.protocol ?? 'openai-chat-completions',
  );
  const serverFlavor = normalizedEnum(
    provider.serverFlavor,
    providerServerFlavors,
    fallback?.serverFlavor ?? (kind === 'openai' ? 'openai' : 'auto'),
  );
  const baseUrl = text(provider.baseUrl || fallback?.baseUrl).replace(
    /\/+$/,
    '',
  );
  const models = normalizeAiModels(provider.models ?? fallback?.models ?? []);
  if (
    !id ||
    !label ||
    !baseUrl ||
    !['openai', 'openai-compatible', 'ollama'].includes(kind)
  ) {
    throw new AiProviderConfigurationError(
      'AI provider has invalid configuration.',
    );
  }
  return {
    id,
    label,
    kind: kind as AutomationAiProvider['kind'],
    protocol,
    serverFlavor,
    baseUrl:
      kind === 'openai' && baseUrl === 'https://api.openai.com'
        ? 'https://api.openai.com/v1'
        : baseUrl,
    apiKey: provider.apiKey === null ? null : text(provider.apiKey) || null,
    models,
    enabled: provider.enabled !== false,
  };
};

const normalizeAiModels = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const models: AutomationAiProviderModel[] = [];
  for (const rawModel of value) {
    const model = normalizeAiModel(rawModel);
    if (!model || seen.has(model.id)) {
      continue;
    }
    seen.add(model.id);
    models.push(model);
  }
  return normalizeDefaultModel(models);
};

export const normalizeAiModel = (
  rawModel: unknown,
): AutomationAiProviderModel => {
  if (!rawModel || typeof rawModel !== 'object' || Array.isArray(rawModel)) {
    throw new AiProviderConfigurationError(
      'AI provider model must be an object.',
    );
  }
  const model = rawModel as Record<string, unknown>;
  const id = text(model.id);
  const label = text(model.label) || id;
  if (!id || !label) {
    throw new AiProviderConfigurationError(
      'AI provider model has invalid identity.',
    );
  }
  const roles = normalizeAiModelRoles(model.roles);
  const capabilities = normalizeAiModelCapabilities(model.capabilities);
  return {
    id,
    label,
    roles,
    settings: normalizeAiModelSettings(model.settings),
    enabled: model.enabled !== false,
    defaultFor: normalizeAiModelDefaultFor(model.defaultFor, roles, model),
    ...(Object.keys(capabilities).length > 0 ? { capabilities } : {}),
  };
};

const normalizeAiModelDefaultFor = (
  rawDefaultFor: unknown,
  roles: AutomationAiProviderModelRole[],
  rawModel?: Record<string, unknown>,
): AutomationAiProviderModelRole[] => {
  if (Array.isArray(rawDefaultFor)) {
    return Array.from(
      new Set(
        rawDefaultFor.filter(
          (role): role is AutomationAiProviderModelRole =>
            roles.includes(role as AutomationAiProviderModelRole) &&
            modelRoles.includes(role as AutomationAiProviderModelRole),
        ),
      ),
    );
  }

  if (rawModel?.default === true) {
    return roles;
  }

  return [];
};

const normalizeAiModelRoles = (
  rawRoles: unknown,
): AutomationAiProviderModelRole[] => {
  if (!Array.isArray(rawRoles)) return ['controller', 'planner'];
  const roles = rawRoles.filter((role): role is AutomationAiProviderModelRole =>
    modelRoles.includes(role as AutomationAiProviderModelRole),
  );
  if (roles.includes('planner') && !roles.includes('controller')) {
    roles.unshift('controller');
  }
  return Array.from(new Set(roles));
};

const normalizeAiModelCapabilities = (
  value: unknown,
): AutomationAiProviderModelCapabilities => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const capabilities = value as Record<string, unknown>;
  return Object.fromEntries(
    ['streaming', 'structuredOutput', 'tools', 'vision', 'reasoning']
      .filter((key) => typeof capabilities[key] === 'boolean')
      .map((key) => [key, capabilities[key]]),
  ) as AutomationAiProviderModelCapabilities;
};

const normalizeAiModelSettings = (rawSettings: unknown) => {
  const settings =
    rawSettings &&
    typeof rawSettings === 'object' &&
    !Array.isArray(rawSettings)
      ? (rawSettings as Record<string, unknown>)
      : {};
  return {
    systemPrompt: nullableText(settings.systemPrompt),
    temperature: nullableNumber(settings.temperature, 0, 2),
    topP: nullableNumber(settings.topP, 0, 1),
    topK: nullableInteger(settings.topK, 0, 500),
    numCtx: nullableInteger(settings.numCtx, 128, 262144),
    repeatPenalty: nullableNumber(settings.repeatPenalty, 0, 4),
    seed: nullableInteger(settings.seed, -2147483648, 2147483647),
    keepAlive: nullableText(settings.keepAlive),
    thinkingMode: normalizedNullableEnum(settings.thinkingMode, thinkingModes),
    reasoningBudgetTokens: nullableInteger(
      settings.reasoningBudgetTokens,
      0,
      32768,
    ),
  };
};

const normalizedEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
) => {
  const normalized = text(value);
  return allowed.includes(normalized as T) ? (normalized as T) : fallback;
};

const normalizedNullableEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null => {
  const normalized = text(value);
  return allowed.includes(normalized as T) ? (normalized as T) : null;
};

export const resolveUpdatedApiKey = (
  current: string | null | undefined,
  next: string | null | undefined,
) => {
  if (next === undefined || next === MASKED_API_KEY) {
    return current ?? null;
  }
  return text(next) || null;
};

export const maskProvider = (provider: AutomationAiProvider) => ({
  ...provider,
  apiKey: provider.apiKey ? MASKED_API_KEY : null,
});
