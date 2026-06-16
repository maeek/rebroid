import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  aiModelDisplayName,
  aiModelSubtitle,
  aiProviderKindLabel,
  catalogByRole,
  createProviderModelRows,
  MASKED_API_KEY,
  nextCatalogProviderAndModel,
  normalizeAiModel,
  normalizeAiProvider,
  normalizeDefaultModel,
  normalizeProviderForm,
  recommendAiModelForAutomation,
  resolveUpdatedApiKey,
  selectCatalogModel,
  selectCatalogProvider,
  selectCatalogProviderAndModel,
  selectInitialPlannerVisionCatalog,
  selectMatchingVisionPair,
  setDefaultProviderModelAt,
  updateProviderModelAt,
  type AiModelCatalogProvider,
  type AutomationAiProvider,
} from "./provider";

const provider: AutomationAiProvider = {
  id: " local ",
  label: " ",
  kind: "ollama",
  baseUrl: "http://localhost:11434///",
  apiKey: " secret ",
  enabled: true,
  models: [
    {
      id: " qwen ",
      label: " ",
      roles: ["planner"],
      settings: {},
      enabled: true,
      defaultFor: ["planner"],
    },
    {
      id: " ",
      label: "Ignored",
      roles: ["planner"],
      settings: {},
      enabled: false,
      defaultFor: [],
    },
  ],
};

const catalog = [
  {
    id: "planner-only",
    label: "Planner Only",
    kind: "openai",
    models: [
      {
        id: "p-default",
        label: "Planner Default",
        roles: ["planner"],
        defaultFor: ["planner"],
      },
      {
        id: "p-extra",
        label: "Planner Extra",
        roles: ["planner"],
        defaultFor: [],
      },
    ],
  },
  {
    id: "vision-only",
    label: "Vision Only",
    kind: "openai-compatible",
    models: [
      {
        id: "v-default",
        label: "Vision Default",
        roles: ["vision"],
        defaultFor: ["vision"],
      },
    ],
  },
  {
    id: "shared",
    label: "Shared",
    kind: "ollama",
    models: [
      {
        id: "shared-default",
        label: "Shared Default",
        roles: ["planner", "vision"],
        defaultFor: ["planner", "vision"],
      },
    ],
  },
] satisfies AiModelCatalogProvider[];

describe("AI provider core", () => {
  it("normalizes provider and model input", () => {
    assert.deepEqual(normalizeProviderForm(provider), {
      ...provider,
      id: "local",
      label: "local",
      baseUrl: "http://localhost:11434",
      apiKey: "secret",
      models: [
        {
          ...provider.models[0],
          id: "qwen",
          label: "qwen",
        },
      ],
    });
  });

  it("normalizes provider persistence shape", () => {
    assert.deepEqual(
      normalizeAiProvider({
        id: "openai",
        label: "OpenAI",
        kind: "openai",
        baseUrl: "https://api.openai.com///",
        models: [{ id: "gpt-4o", label: "", default: true }],
      }),
      {
        id: "openai",
        label: "OpenAI",
        kind: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: null,
        enabled: true,
        models: [
          {
            id: "gpt-4o",
            label: "gpt-4o",
            roles: ["planner"],
            settings: {
              systemPrompt: null,
              temperature: null,
              topP: null,
              topK: null,
              numCtx: null,
              repeatPenalty: null,
              seed: null,
              keepAlive: null,
            },
            enabled: true,
            defaultFor: ["planner"],
          },
        ],
      },
    );
  });

  it("keeps exactly one enabled default model per role", () => {
    const models = [
      normalizeAiModel({ id: "a", label: "a", default: true, enabled: false }),
      normalizeAiModel({
        id: "b",
        label: "b",
        roles: ["planner", "vision"],
        defaultFor: ["planner", "vision"],
        enabled: true,
      }),
      normalizeAiModel({
        id: "c",
        label: "c",
        roles: ["vision"],
        defaultFor: ["vision"],
        enabled: true,
      }),
    ];
    assert.deepEqual(
      normalizeDefaultModel(models).map((model) => model.defaultFor),
      [[], ["planner", "vision"], []],
    );
  });

  it("normalizes explicit model roles", () => {
    assert.deepEqual(
      normalizeAiModel({
        id: "gpt-4o",
        label: "gpt-4o",
        roles: ["planner", "vision", "bad"],
      }),
      {
        id: "gpt-4o",
        label: "gpt-4o",
        roles: ["planner", "vision"],
        settings: {
          systemPrompt: null,
          temperature: null,
          topP: null,
          topK: null,
          numCtx: null,
          repeatPenalty: null,
          seed: null,
          keepAlive: null,
        },
        enabled: true,
        defaultFor: [],
      },
    );
  });

  it("preserves masked API keys during updates", () => {
    assert.equal(resolveUpdatedApiKey("stored", undefined), "stored");
    assert.equal(resolveUpdatedApiKey("stored", MASKED_API_KEY), "stored");
    assert.equal(resolveUpdatedApiKey("stored", " next "), "next");
    assert.equal(resolveUpdatedApiKey("stored", ""), null);
  });

  it("creates and updates stable editable model rows", () => {
    const rows = createProviderModelRows(
      normalizeProviderForm(provider).models,
    );
    assert.deepEqual(
      rows.map((row) => row.rowId),
      ["0:qwen"],
    );

    const models = [
      {
        ...normalizeProviderForm(provider).models[0],
        defaultFor: ["planner" as const],
      },
      {
        ...normalizeProviderForm(provider).models[0],
        id: "other",
        defaultFor: [],
      },
    ];
    assert.deepEqual(
      updateProviderModelAt(models, 1, { defaultFor: ["planner"] }).map(
        (model) => model.defaultFor,
      ),
      [[], ["planner"]],
    );
    assert.deepEqual(
      setDefaultProviderModelAt(models, 1, "planner").map(
        (model) => model.defaultFor,
      ),
      [[], ["planner"]],
    );
  });

  it("recommends GUI-oriented vision models for mobile automation", () => {
    assert.deepEqual(
      recommendAiModelForAutomation({
        id: "qwen2.5-vl:7b",
        label: "Qwen2.5 VL 7B",
        roles: ["planner", "vision"],
      }),
      {
        level: "good",
        title: "GUI-oriented",
        message:
          "Good fit for mobile/GUI grounding. Prefer this for vision or shared planner+vision when health checks pass.",
      },
    );
  });

  it("warns when general VLMs are used as combined GUI controllers", () => {
    assert.equal(
      recommendAiModelForAutomation({
        id: "gemma4:e4b-mlx",
        label: "Gemma 4",
        roles: ["planner", "vision"],
      }).level,
      "warning",
    );
  });

  it("filters catalog by model role", () => {
    assert.deepEqual(
      catalogByRole(catalog, "planner").map((item) => item.id),
      ["planner-only", "shared"],
    );
    assert.deepEqual(
      catalogByRole(catalog, "vision").map((item) => item.id),
      ["vision-only", "shared"],
    );
  });

  it("falls back to first provider and default model when ids are missing", () => {
    const provider = selectCatalogProvider(catalogByRole(catalog, "planner"), "");
    const model = selectCatalogModel(provider, "");

    assert.equal(provider?.id, "planner-only");
    assert.equal(model?.id, "p-default");
  });

  it("selects provider and model together", () => {
    const selected = selectCatalogProviderAndModel(
      catalog,
      "planner-only",
      "p-extra",
    );

    assert.equal(selected.provider?.id, "planner-only");
    assert.equal(selected.model?.id, "p-extra");
  });

  it("selects the next provider default model when provider changes", () => {
    const selected = nextCatalogProviderAndModel(catalog, "vision-only");

    assert.equal(selected.provider?.id, "vision-only");
    assert.equal(selected.model?.id, "v-default");
  });

  it("selects shared planner and vision models for initial settings", () => {
    const selected = selectInitialPlannerVisionCatalog([catalog[2], ...catalog]);

    assert.equal(selected.selectedProvider?.id, "shared");
    assert.equal(selected.selectedModel?.id, "shared-default");
    assert.equal(selected.selectedVisionProvider?.id, "shared");
    assert.equal(selected.selectedVisionModel?.id, "shared-default");
  });

  it("matches a planner model to the same vision model when available", () => {
    const plannerProvider = catalog[2];
    const plannerModel = plannerProvider.models[0];
    const matched = selectMatchingVisionPair({
      plannerModel,
      plannerProvider,
      visionCatalog: catalogByRole(catalog, "vision"),
    });

    assert.equal(matched.provider?.id, "shared");
    assert.equal(matched.model?.id, "shared-default");
  });

  it("formats provider and model labels for picker surfaces", () => {
    const provider = catalog[1];
    const model = provider.models[0];

    assert.equal(aiProviderKindLabel("openai-compatible"), "OpenAI-compatible");
    assert.equal(aiModelDisplayName(model), "Vision Default");
    assert.equal(aiModelSubtitle(provider, model), "OpenAI-compatible · Vision Only");
  });
});
