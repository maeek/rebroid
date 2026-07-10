import type {
  AutomationAiProviderKind,
  AutomationAiProviderModelRole,
} from "./types";

export type AiModelRole = AutomationAiProviderModelRole;
export type AiProviderKind = AutomationAiProviderKind;

export interface AiCatalogModel {
  id: string;
  label: string;
  roles?: AiModelRole[];
  defaultFor?: AiModelRole[];
}

export interface AiModelCatalogProvider<
  TModel extends AiCatalogModel = AiCatalogModel,
> {
  id: string;
  label: string;
  kind: AiProviderKind;
  models: TModel[];
}

export interface AiCatalogSelection<
  TProvider extends AiModelCatalogProvider = AiModelCatalogProvider,
> {
  provider: TProvider | undefined;
  model: TProvider["models"][number] | undefined;
}

export interface PlannerVisionCatalogSelection<
  TProvider extends AiModelCatalogProvider = AiModelCatalogProvider,
> {
  plannerCatalog: TProvider[];
  visionCatalog: TProvider[];
  selectedProvider: TProvider | undefined;
  selectedModel: TProvider["models"][number] | undefined;
  selectedVisionProvider: TProvider | undefined;
  selectedVisionModel: TProvider["models"][number] | undefined;
}

export const catalogByRole = <TProvider extends AiModelCatalogProvider>(
  catalog: TProvider[],
  role: AiModelRole,
): TProvider[] =>
  catalog
    .map(
      (provider) =>
        ({
          ...provider,
          models: provider.models.filter((model) =>
            model.roles?.includes(role),
          ),
        }) as TProvider,
    )
    .filter((provider) => provider.models.length > 0);

export const selectCatalogProvider = <TProvider extends AiModelCatalogProvider>(
  catalog: TProvider[],
  providerId: string,
): TProvider | undefined =>
  catalog.find((provider) => provider.id === providerId) ?? catalog[0];

export const selectCatalogModel = <TProvider extends AiModelCatalogProvider>(
  provider: TProvider | undefined,
  modelId: string,
  role?: AiModelRole,
): TProvider["models"][number] | undefined =>
  provider?.models.find((model) => model.id === modelId) ??
  provider?.models.find((model) =>
    role ? model.defaultFor?.includes(role) : model.defaultFor?.length,
  ) ??
  provider?.models[0];

export const selectCatalogProviderAndModel = <
  TProvider extends AiModelCatalogProvider,
>(
  catalog: TProvider[],
  providerId: string,
  modelId: string,
  role?: AiModelRole,
): AiCatalogSelection<TProvider> => {
  const provider = selectCatalogProvider(catalog, providerId);
  const model = selectCatalogModel(provider, modelId, role);

  return { provider, model };
};

export const nextCatalogProviderAndModel = <
  TProvider extends AiModelCatalogProvider,
>(
  catalog: TProvider[],
  providerId: string,
  role?: AiModelRole,
): AiCatalogSelection<TProvider> => {
  const provider = selectCatalogProvider(catalog, providerId);
  const model = selectCatalogModel(provider, "", role);

  return { provider, model };
};

export const selectPlannerVisionCatalog = <
  TProvider extends AiModelCatalogProvider,
>({
  catalog,
  modelId,
  providerId,
  visionModelId,
  visionProviderId,
}: {
  catalog: TProvider[];
  modelId: string;
  providerId: string;
  visionModelId: string;
  visionProviderId: string;
}): PlannerVisionCatalogSelection<TProvider> => {
  const plannerCatalog = catalogByRole(catalog, "planner");
  const visionCatalog = catalogByRole(catalog, "vision");
  const selectedProvider = selectCatalogProvider(plannerCatalog, providerId);
  const selectedModel = selectCatalogModel(
    selectedProvider,
    modelId,
    "planner",
  );
  const selectedVisionProvider = selectCatalogProvider(
    visionCatalog,
    visionProviderId,
  );
  const selectedVisionModel = selectCatalogModel(
    selectedVisionProvider,
    visionModelId,
    "vision",
  );

  return {
    plannerCatalog,
    visionCatalog,
    selectedProvider,
    selectedModel,
    selectedVisionProvider,
    selectedVisionModel,
  };
};

export const selectMatchingVisionPair = <
  TProvider extends AiModelCatalogProvider,
>({
  plannerModel,
  plannerProvider,
  requireVisionDefault = false,
  visionCatalog,
}: {
  plannerModel: TProvider["models"][number] | undefined;
  plannerProvider: TProvider | undefined;
  requireVisionDefault?: boolean;
  visionCatalog: TProvider[];
}): AiCatalogSelection<TProvider> => {
  if (!plannerProvider || !plannerModel?.roles?.includes("vision")) {
    return { provider: undefined, model: undefined };
  }

  const provider = visionCatalog.find((item) => item.id === plannerProvider.id);
  const model = provider?.models.find(
    (item) =>
      item.id === plannerModel.id &&
      (!requireVisionDefault || item.defaultFor?.includes("vision")),
  );

  return model
    ? { provider, model }
    : { provider: undefined, model: undefined };
};

export const selectInitialPlannerVisionCatalog = <
  TProvider extends AiModelCatalogProvider,
>(
  catalog: TProvider[],
): PlannerVisionCatalogSelection<TProvider> => {
  const plannerCatalog = catalogByRole(catalog, "planner");
  const visionCatalog = catalogByRole(catalog, "vision");
  const selectedProvider = plannerCatalog[0];
  const selectedModel = selectCatalogModel(selectedProvider, "", "planner");
  const matchingVision = selectMatchingVisionPair({
    plannerModel: selectedModel,
    plannerProvider: selectedProvider,
    requireVisionDefault: true,
    visionCatalog,
  });
  const selectedVisionProvider = matchingVision.provider ?? visionCatalog[0];
  const selectedVisionModel =
    matchingVision.model ??
    selectCatalogModel(selectedVisionProvider, "", "vision");

  return {
    plannerCatalog,
    visionCatalog,
    selectedProvider,
    selectedModel,
    selectedVisionProvider,
    selectedVisionModel,
  };
};

export const aiProviderKindLabel = (kind: AiProviderKind) => {
  if (kind === "openai") return "OpenAI";
  if (kind === "openai-compatible") return "OpenAI-compatible";
  return "Ollama";
};

export const aiModelRoleLabel = (role: AiModelRole) => {
  if (role === "vision") return "Vision";
  return "Planner";
};

export const aiProviderDisplayName = (
  provider: AiModelCatalogProvider | undefined,
) => provider?.label || provider?.id || "No provider";

export const aiModelDisplayName = (model: AiCatalogModel | undefined) =>
  model?.label || model?.id || "No model";

export const aiModelSubtitle = (
  provider: AiModelCatalogProvider | undefined,
  model: AiCatalogModel | undefined,
) => {
  if (!provider || !model) return "Configure AI";
  return `${aiProviderKindLabel(provider.kind)} · ${provider.label}`;
};
