export type AutomationAiProviderKind =
  | "openai"
  | "openai-compatible"
  | "ollama";

export interface AutomationAiProvider {
  id: string;
  label: string;
  kind: AutomationAiProviderKind;
  baseUrl: string;
  apiKey?: string | null;
  models: AutomationAiProviderModel[];
  enabled: boolean;
}

export interface AutomationAiProviderModel {
  id: string;
  label: string;
  settings: AutomationAiProviderModelSettings;
  supportsVision: boolean;
  supportsTools: boolean;
  enabled: boolean;
  default: boolean;
}

export interface AutomationAiProviderModelSettings {
  systemPrompt?: string | null;
  temperature?: number | null;
  topP?: number | null;
  topK?: number | null;
  numCtx?: number | null;
  repeatPenalty?: number | null;
  seed?: number | null;
  keepAlive?: string | null;
}

export interface AutomationAiRunInput {
  prompt: string;
  providerId?: string;
  modelId?: string;
  maxToolCalls: number;
  timeoutMs: number;
  allowedTools?: string[];
  requireFinalAnswer: boolean;
}

export interface AutomationAiToolRequest {
  name: string;
  arguments: Record<string, unknown>;
}

export type ProviderFormState = AutomationAiProvider;

export type ProviderModelRow = AutomationAiProviderModel & {
  rowId: string;
  index: number;
};

export const MASKED_API_KEY = "********";

export class AiProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderConfigurationError";
  }
}

export const defaultAiProviders = (): AutomationAiProvider[] => [
  {
    id: "local-ollama",
    label: "Local Ollama",
    kind: "ollama",
    baseUrl: "http://localhost:11434",
    apiKey: null,
    models: [
      {
        id: "qwen2.5vl:7b",
        label: "Qwen 2.5 VL 7B",
        settings: {},
        supportsVision: true,
        supportsTools: true,
        enabled: true,
        default: true,
      },
      {
        id: "qwen2.5:7b",
        label: "Qwen 2.5 7B",
        settings: {},
        supportsVision: false,
        supportsTools: true,
        enabled: true,
        default: false,
      },
    ],
    enabled: false,
  },
];

export const emptyProvider = (): ProviderFormState => ({
  id: "",
  label: "",
  kind: "ollama",
  baseUrl: "http://localhost:11434",
  apiKey: null,
  enabled: false,
  models: [],
});

export const emptyModel = (): AutomationAiProviderModel => ({
  id: "",
  label: "",
  settings: {},
  supportsVision: false,
  supportsTools: false,
  enabled: true,
  default: false,
});

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

export const normalizeDefaultModel = (models: AutomationAiProviderModel[]) => {
  let defaultAssigned = false;
  const enabledDefaultIndex = models.findIndex(
    (model) => model.enabled && model.default,
  );
  const fallbackDefaultIndex = models.findIndex((model) => model.enabled);
  const defaultIndex =
    enabledDefaultIndex >= 0 ? enabledDefaultIndex : fallbackDefaultIndex;
  return models.map((model, index) => {
    const isDefault = index === defaultIndex && !defaultAssigned;
    defaultAssigned ||= isDefault;
    return { ...model, default: isDefault };
  });
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

export const modelLikelySupportsVision = (modelId: string, label?: string) =>
  /\b(vl|vision|visual|multimodal|gpt-4o|o4|llava|pixtral|gemini)\b/i.test(
    `${modelId} ${label ?? ""}`,
  );

export const inferModelCapabilities = (
  model: Pick<AutomationAiProviderModel, "id" | "label">,
) => ({
  supportsVision: modelLikelySupportsVision(model.id, model.label),
  supportsTools: Boolean(model.id.trim()),
});

export const normalizeProviderForm = (
  provider: ProviderFormState,
): AutomationAiProvider => ({
  ...provider,
  id: provider.id.trim(),
  label: provider.label.trim() || provider.id.trim(),
  baseUrl: provider.baseUrl.trim().replace(/\/+$/, ""),
  apiKey: provider.apiKey?.trim() || null,
  models: provider.models
    .map((model) => ({
      ...model,
      id: model.id.trim(),
      label: model.label.trim() || model.id.trim(),
      settings: model.settings ?? {},
      ...inferModelCapabilities({
        id: model.id.trim(),
        label: model.label.trim() || model.id.trim(),
      }),
    }))
    .filter((model) => model.id.length > 0),
});

export const createProviderModelRows = (
  models: AutomationAiProviderModel[],
): ProviderModelRow[] =>
  models.map((model, index) => ({
    ...model,
    index,
    rowId: `${index}:${model.id || "new"}`,
  }));

export const updateProviderModelAt = (
  models: AutomationAiProviderModel[],
  index: number,
  patch: Partial<AutomationAiProviderModel>,
) =>
  models.map((model, modelIndex) => {
    if (patch.default && modelIndex !== index)
      return { ...model, default: false };
    return modelIndex === index ? { ...model, ...patch } : model;
  });

export const setDefaultProviderModelAt = (
  models: AutomationAiProviderModel[],
  index: number,
) =>
  models.map((model, modelIndex) => ({
    ...model,
    default: modelIndex === index,
  }));

export const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const nullableText = (value: unknown) => text(value) || null;

const nullableNumber = (value: unknown, min: number, max: number) => {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : null;
};

const nullableInteger = (value: unknown, min: number, max: number) => {
  const number = nullableNumber(value, min, max);
  return number === null ? null : Math.round(number);
};
