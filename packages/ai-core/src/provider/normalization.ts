import { defaultAiProviders, MASKED_API_KEY } from "./defaults";
import { normalizeDefaultModel } from "./model-capabilities";
import {
  nullableInteger,
  nullableNumber,
  nullableText,
  text,
} from "./text-values";
import {
  AiProviderConfigurationError,
  type AutomationAiProvider,
  type AutomationAiProviderModel,
} from "./types";

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
    typeof rawProvider !== "object" ||
    Array.isArray(rawProvider)
  ) {
    throw new AiProviderConfigurationError("AI provider must be an object.");
  }
  const provider = rawProvider as Record<string, unknown>;
  const id = text(provider.id) || fallback?.id || "";
  const label = text(provider.label) || fallback?.label || id;
  const kind = text(provider.kind) || fallback?.kind || "";
  const baseUrl = text(provider.baseUrl || fallback?.baseUrl).replace(
    /\/+$/,
    "",
  );
  const models = normalizeAiModels(provider.models ?? fallback?.models ?? []);
  if (
    !id ||
    !label ||
    !baseUrl ||
    !["openai", "openai-compatible", "ollama"].includes(kind)
  ) {
    throw new AiProviderConfigurationError(
      "AI provider has invalid configuration.",
    );
  }
  return {
    id,
    label,
    kind: kind as AutomationAiProvider["kind"],
    baseUrl:
      kind === "openai" && baseUrl === "https://api.openai.com"
        ? "https://api.openai.com/v1"
        : baseUrl,
    apiKey: provider.apiKey === null ? null : text(provider.apiKey) || null,
    models,
    enabled: provider.enabled !== false,
  };
};

export const normalizeAiModels = (value: unknown) => {
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
  if (!rawModel || typeof rawModel !== "object" || Array.isArray(rawModel)) {
    throw new AiProviderConfigurationError(
      "AI provider model must be an object.",
    );
  }
  const model = rawModel as Record<string, unknown>;
  const id = text(model.id);
  const label = text(model.label) || id;
  if (!id || !label) {
    throw new AiProviderConfigurationError(
      "AI provider model has invalid identity.",
    );
  }
  return {
    id,
    label,
    settings: normalizeAiModelSettings(model.settings),
    supportsVision: model.supportsVision !== false,
    supportsTools: model.supportsTools !== false,
    enabled: model.enabled !== false,
    default: model.default === true,
  };
};

export const normalizeAiModelSettings = (rawSettings: unknown) => {
  const settings =
    rawSettings &&
    typeof rawSettings === "object" &&
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
  };
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
