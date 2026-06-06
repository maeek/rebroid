import type { AutomationAiProviderModel } from "./types";

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
