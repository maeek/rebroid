import type {
  AutomationAiProviderModel,
  AutomationAiProviderModelRole,
} from "./types";

export const normalizeDefaultModel = (models: AutomationAiProviderModel[]) => {
  const defaultByRole = new Map<AutomationAiProviderModelRole, number>();
  for (const role of modelRoles) {
    const explicitDefaultIndex = models.findIndex(
      (model) =>
        model.enabled &&
        model.roles.includes(role) &&
        model.defaultFor.includes(role),
    );
    const fallbackDefaultIndex = models.findIndex(
      (model) => model.enabled && model.roles.includes(role),
    );
    const defaultIndex =
      explicitDefaultIndex >= 0 ? explicitDefaultIndex : fallbackDefaultIndex;
    if (defaultIndex >= 0) defaultByRole.set(role, defaultIndex);
  }

  return models.map((model, index) => ({
    ...model,
    defaultFor: model.roles.filter((role) => defaultByRole.get(role) === index),
  }));
};

export const modelRoles = ["controller", "planner", "vision"] as const;
