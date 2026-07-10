import type {
  AutomationAiProvider,
  AutomationAiProviderRemoteModel,
} from "./types";
import { providerModelsEndpoint } from "../harness/request-body";

export const providerModelsUrl = (provider: AutomationAiProvider) =>
  providerModelsEndpoint(provider);

export const providerRemoteModelsUrl = (provider: AutomationAiProvider) =>
  providerModelsEndpoint(provider);

export const parseProviderRemoteModels = (
  _provider: Pick<AutomationAiProvider, "kind">,
  body: unknown,
): AutomationAiProviderRemoteModel[] => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return [];
  }
  const record = body as Record<string, unknown>;
  return Array.isArray(record.data)
    ? parseOpenAiRemoteModels(record)
    : parseOllamaRemoteModels(record);
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
        label: textValue(model.name) || id,
        ...(textValue(model.owned_by)
          ? { family: textValue(model.owned_by) }
          : {}),
        ...(parseCapabilityLabels(model)
          ? { capabilities: parseCapabilityLabels(model) }
          : {}),
      };
    })
    .filter((model): model is AutomationAiProviderRemoteModel =>
      Boolean(model),
    );
};

const textValue = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const parseCapabilityLabels = (model: Record<string, unknown>) => {
  const raw = Array.isArray(model.labels)
    ? model.labels
    : Array.isArray(model.capabilities)
      ? model.capabilities
      : [];
  const labels = new Set(
    raw.filter((value): value is string => typeof value === "string"),
  );
  const capabilities = {
    ...(labels.has("tool-calling") || labels.has("tools")
      ? { tools: true }
      : {}),
    ...(labels.has("vision") ? { vision: true } : {}),
    ...(labels.has("reasoning") ? { reasoning: true } : {}),
  };
  return Object.keys(capabilities).length > 0 ? capabilities : null;
};
