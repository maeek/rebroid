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
      default: true,
    },
    {
      id: " ",
      label: "Ignored",
      roles: ["planner"],
      settings: {},
      enabled: false,
      default: false,
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
            default: true,
          },
        ],
      },
    );
  });

  it("keeps exactly one enabled default model", () => {
    const models = [
      normalizeAiModel({ id: "a", label: "a", default: true, enabled: false }),
      normalizeAiModel({ id: "b", label: "b", default: false, enabled: true }),
    ];
    assert.deepEqual(
      normalizeDefaultModel(models).map((model) => model.default),
      [false, true],
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
        default: false,
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
      { ...normalizeProviderForm(provider).models[0], default: true },
      {
        ...normalizeProviderForm(provider).models[0],
        id: "other",
        default: false,
      },
    ];
    assert.deepEqual(
      updateProviderModelAt(models, 1, { default: true }).map(
        (model) => model.default,
      ),
      [false, true],
    );
    assert.deepEqual(
      setDefaultProviderModelAt(models, 1).map((model) => model.default),
      [false, true],
    );
  });
});
