import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
  ProviderFormState,
  ProviderModelRow,
} from "./types";

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
  enabled: true,
  default: false,
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
