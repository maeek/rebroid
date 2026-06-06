import type {
  AutomationAiProvider,
  AutomationAiProviderRemoteModel,
} from "./types";

export const providerModelsUrl = (provider: AutomationAiProvider) => {
  const baseUrl = provider.baseUrl.replace(/\/+$/, "");
  if (provider.kind === "ollama") {
    return `${baseUrl}/v1/models`;
  }
  return `${baseUrl}/models`;
};

export const providerRemoteModelsUrl = (provider: AutomationAiProvider) => {
  const baseUrl = provider.baseUrl.replace(/\/+$/, "");
  if (provider.kind === "ollama") {
    return `${baseUrl}/api/tags`;
  }
  return providerModelsUrl(provider);
};

export const parseProviderRemoteModels = (
  provider: Pick<AutomationAiProvider, "kind">,
  body: unknown,
): AutomationAiProviderRemoteModel[] => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [];
  }
  return provider.kind === "ollama"
    ? parseOllamaRemoteModels(body as Record<string, unknown>)
    : parseOpenAiRemoteModels(body as Record<string, unknown>);
};

const parseOllamaRemoteModels = (
  body: Record<string, unknown>,
): AutomationAiProviderRemoteModel[] => {
  if (!Array.isArray(body.models)) {
    return [];
  }
  return body.models
    .map((rawModel) => {
      if (!rawModel || typeof rawModel !== "object" || Array.isArray(rawModel))
        return null;
      const model = rawModel as Record<string, unknown>;
      const details =
        model.details &&
        typeof model.details === "object" &&
        !Array.isArray(model.details)
          ? (model.details as Record<string, unknown>)
          : {};
      const id = textValue(model.name) || textValue(model.model);
      if (!id) return null;
      return {
        id,
        label: id,
        ...(textValue(details.family)
          ? { family: textValue(details.family) }
          : {}),
        ...(textValue(details.parameter_size)
          ? { parameterSize: textValue(details.parameter_size) }
          : {}),
        ...(textValue(details.quantization_level)
          ? { quantizationLevel: textValue(details.quantization_level) }
          : {}),
      };
    })
    .filter((model): model is AutomationAiProviderRemoteModel =>
      Boolean(model),
    );
};

const parseOpenAiRemoteModels = (
  body: Record<string, unknown>,
): AutomationAiProviderRemoteModel[] => {
  if (!Array.isArray(body.data)) {
    return [];
  }
  return body.data
    .map((rawModel) => {
      if (!rawModel || typeof rawModel !== "object" || Array.isArray(rawModel))
        return null;
      const model = rawModel as Record<string, unknown>;
      const id = textValue(model.id);
      if (!id) return null;
      return {
        id,
        label: id,
        ...(textValue(model.owned_by)
          ? { family: textValue(model.owned_by) }
          : {}),
      };
    })
    .filter((model): model is AutomationAiProviderRemoteModel =>
      Boolean(model),
    );
};

const textValue = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
