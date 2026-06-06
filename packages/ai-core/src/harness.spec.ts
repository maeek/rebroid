import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  allowedToolMatcher,
  buildChatRequestBody,
  buildInitialMessages,
  buildToolDefinitions,
  chatCompletionsEndpoint,
  mapUsesByToolName,
  parseArguments,
  toolName,
} from "./harness";
import type {
  AutomationAiProvider,
  AutomationAiProviderModel,
} from "./provider";

const provider: AutomationAiProvider = {
  id: "local",
  label: "Local",
  kind: "ollama",
  baseUrl: "http://localhost:11434/",
  apiKey: null,
  enabled: true,
  models: [],
};

const model: AutomationAiProviderModel = {
  id: "qwen",
  label: "Qwen",
  settings: {
    systemPrompt: "Use terse summaries.",
    temperature: 0.5,
    topP: 0.9,
    numCtx: 4096,
    topK: 20,
    repeatPenalty: null,
    seed: null,
    keepAlive: "5m",
  },
  supportsVision: true,
  supportsTools: true,
  enabled: true,
  default: true,
};

describe("AI harness core", () => {
  it("maps automation command names to OpenAI-compatible tool names", () => {
    assert.equal(toolName("android.tap"), "android__tap");
    assert.equal(
      mapUsesByToolName([{ uses: "android.tap" }]).get("android__tap"),
      "android.tap",
    );
  });

  it("filters tools by allowed automation uses", () => {
    const allowed = allowedToolMatcher(["android.tap"]);
    assert.deepEqual(
      buildToolDefinitions(
        [
          {
            uses: "android.tap",
            label: "Tap",
            description: "Tap screen",
            inputSchema: { type: "object" },
          },
          {
            uses: "ai.run",
            label: "AI",
            description: "Nested AI",
            inputSchema: {},
          },
        ],
        allowed,
      ).map((tool) => tool.function.name),
      ["android__tap"],
    );
  });

  it("builds chat messages and provider request bodies", () => {
    assert.equal(
      chatCompletionsEndpoint(provider),
      "http://localhost:11434/v1/chat/completions",
    );
    assert.deepEqual(buildInitialMessages({ prompt: "Do it" }, model), [
      {
        role: "system",
        content:
          "You are controlling an Android automation through typed tools. Use tools only when needed, keep progress concise, and finish with a short visible summary. Never invent tool results.\n\nUse terse summaries.",
      },
      { role: "user", content: "Do it" },
    ]);
    assert.deepEqual(
      buildChatRequestBody({
        provider,
        model,
        messages: [],
        tools: [],
      }),
      {
        model: "qwen",
        messages: [],
        tools: [],
        tool_choice: "auto",
        temperature: 0.5,
        top_p: 0.9,
        options: { num_ctx: 4096, top_k: 20 },
        keep_alive: "5m",
      },
    );
  });

  it("parses tool arguments defensively", () => {
    assert.deepEqual(parseArguments('{"x":1}'), { x: 1 });
    assert.deepEqual(parseArguments("[]"), {});
    assert.deepEqual(parseArguments("bad"), {});
  });
});
