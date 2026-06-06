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
          "You are an Android automation agent controlling a live device through typed tools.\nAlways inspect the latest screenshot before choosing screen actions.\nUse only the tools provided to you. Do not invent tool results or assume an action succeeded without observing the screen again.\nAfter every screen-changing action, wait for the fresh screenshot observation before deciding the next action.\nPrefer semantic or state-reading tools when they are available. Use coordinates only when they are clearly supported by the screenshot.\nContinue the observe/action/observe loop until the requested task is visibly complete, the app blocks progress, or a timeout/tool limit is reached.\nWrite concise visible progress and a short final answer. Do not reveal hidden reasoning.\n\nUse terse summaries.",
      },
      { role: "user", content: "Do it" },
    ]);
    assert.deepEqual(
      buildInitialMessages(
        { prompt: "Do it", initialScreenshotDataUrl: "data:image/png;base64,abc" },
        model,
      )[1],
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Do it\n\nCurrent screenshot is attached. Inspect it before taking any action.",
          },
          {
            type: "image_url",
            image_url: { url: "data:image/png;base64,abc" },
          },
        ],
      },
    );
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
