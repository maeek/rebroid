import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  createProviderModelRows,
  MASKED_API_KEY,
  normalizeAiModel,
  normalizeAiProvider,
  normalizeDefaultModel,
  normalizeProviderForm,
  resolveUpdatedApiKey,
  setDefaultProviderModelAt,
  updateProviderModelAt,
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
});
