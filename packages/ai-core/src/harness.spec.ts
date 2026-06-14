import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  allowedToolMatcher,
  buildChatRequestBody,
  buildExecutePlanMessage,
  buildFinalRecoveryMessage,
  buildInitialMessages,
  buildPublicPlanRequestMessage,
  buildReplanMessage,
  buildUiXmlObservationMessage,
  buildToolDefinitions,
  chatCompletionsEndpoint,
  consumeChatCompletionStream,
  mapUsesByToolName,
  normalizePublicAiText,
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
  roles: ["planner"],
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
    assert.equal(
      mapUsesByToolName([{ uses: "vision.locate" }]).get("vision_locate"),
      "vision.locate",
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

  it("wraps tool inputs into a typed execution envelope", () => {
    const [tool] = buildToolDefinitions(
      [
        {
          uses: "android.tap",
          label: "Tap",
          description: "Tap screen",
          inputSchema: {
            type: "object",
            properties: { x: { type: "number" } },
          },
        },
      ],
      () => true,
    );
    assert.equal(tool.type, "function");
    assert.equal(tool.function.name, "android__tap");
    assert.deepEqual(tool.function.parameters.required, [
      "intent",
      "expectedOutcome",
      "input",
    ]);
    assert.equal(tool.function.parameters.properties?.intent.type, "string");
    assert.equal(
      tool.function.parameters.properties?.expectedOutcome.type,
      "string",
    );
    assert.deepEqual(tool.function.parameters.properties?.input, {
      type: "object",
      properties: { x: { type: "number" } },
    });
  });

  it("builds chat messages and provider request bodies", () => {
    const initialMessages = buildInitialMessages({ prompt: "Do it" }, model);
    assert.equal(
      chatCompletionsEndpoint(provider),
      "http://localhost:11434/v1/chat/completions",
    );
    assert.equal(initialMessages.length, 2);
    assert.equal(initialMessages[0].role, "system");
    assert.ok(
      typeof initialMessages[0].content === "string" &&
        initialMessages[0].content.includes(
          "When calling tools, use this exact JSON shape",
        ),
    );
    assert.deepEqual(initialMessages[1], { role: "user", content: "Do it" });
    assert.deepEqual(
      buildInitialMessages(
        {
          prompt: "Do it",
          initialScreenshotDataUrl: "data:image/png;base64,abc",
        },
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
      buildInitialMessages(
        { prompt: "Do it", initialObservationText: "Screen observation" },
        model,
      )[1],
      {
        role: "user",
        content:
          "Do it\n\nCurrent screen observation:\nScreen observation\n\nInspect this observation before taking any action.",
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
        stream: false,
        temperature: 0.5,
        top_p: 0.9,
        options: { num_ctx: 4096, top_k: 20 },
        keep_alive: "5m",
      },
    );
  });

  it("builds text-only UI XML observations", () => {
    assert.deepEqual(
      buildInitialMessages(
        { prompt: "Do it", initialUiXml: "<hierarchy />" },
        model,
      )[1],
      {
        role: "user",
        content:
          "Do it\n\nCurrent UI hierarchy XML:\n<hierarchy />\n\nInspect this UI hierarchy before taking any action.",
      },
    );
    assert.deepEqual(
      buildUiXmlObservationMessage({
        summary: "Fresh UI hierarchy captured.",
        xml: "<node />",
      }),
      {
        role: "user",
        content:
          "Fresh UI hierarchy captured.\n\nCurrent UI hierarchy XML:\n<node />\n\nInspect this latest UI hierarchy before deciding the next step.",
      },
    );
  });

  it("builds public planning and recovery messages", () => {
    const planRequest = buildPublicPlanRequestMessage({
      prompt: "Turn on dark mode",
    });

    assert.equal(planRequest.role, "user");
    const planContent =
      typeof planRequest.content === "string" ? planRequest.content : "";
    assert.ok(planContent);
    assert.ok(planContent.includes("Task: Turn on dark mode"));
    assert.ok(planContent.includes("Current screen"));
    assert.ok(planContent.includes("public execution plan"));
    assert.ok(planContent.includes("Markdown text only"));
    assert.ok(!planContent.includes("hidden reasoning"));

    const executeMessage = buildExecutePlanMessage(
      "1. Open Settings.\n2. Find Display.\n3. Toggle dark mode.",
    );
    assert.equal(executeMessage.role, "user");
    const executeContent =
      typeof executeMessage.content === "string" ? executeMessage.content : "";
    assert.ok(executeContent.includes("Execute the public plan"));

    const replanMessage = buildReplanMessage({
      reason: "vision.locate did not find dark mode toggle.",
      observation:
        "Screen captured: 0 UI hierarchy element(s) detected. Vision summary received.",
    });
    assert.equal(replanMessage.role, "user");
    const replanContent =
      typeof replanMessage.content === "string" ? replanMessage.content : "";
    assert.ok(replanContent.includes("Reason:"));
    assert.ok(replanContent.includes("Latest observation:"));

    const recoveryMessage = buildFinalRecoveryMessage({
      prompt: "Turn on dark mode",
    });
    assert.equal(recoveryMessage.role, "user");
    const recoveryContent =
      typeof recoveryMessage.content === "string"
        ? recoveryMessage.content
        : "";
    assert.ok(recoveryContent.includes("final answer"));
  });

  it("parses tool arguments defensively", () => {
    assert.deepEqual(parseArguments('{"x":1}'), { x: 1 });
    assert.deepEqual(parseArguments("[]"), {});
    assert.deepEqual(parseArguments("bad"), {});
  });

  it("normalizes JSON-like public model text into markdown", () => {
    assert.equal(
      normalizePublicAiText(
        '{"Current screen":"Android home screen","Goal":"Enable system-wide dark mode"}',
      ),
      "- **Current screen:** Android home screen\n- **Goal:** Enable system-wide dark mode",
    );
    assert.equal(
      normalizePublicAiText(
        '{"Result":"Blocked"}\n{"Reason":"Settings path was not visible"}',
      ),
      "- **Result:** Blocked\n\n- **Reason:** Settings path was not visible",
    );
  });

  it("consumes streamed assistant text", async () => {
    const deltas: string[] = [];
    const result = await consumeChatCompletionStream({
      body: streamFromText([
        'data: {"choices":[{"delta":{"content":"Open "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"settings"}}]}\n\n',
        "data: [DONE]\n\n",
      ]),
      onUpdate: ({ contentDelta }) => {
        if (contentDelta) deltas.push(contentDelta);
      },
    });

    assert.deepEqual(deltas, ["Open ", "settings"]);
    assert.equal(result.content, "Open settings");
    assert.deepEqual(result.message, {
      role: "assistant",
      content: "Open settings",
      tool_calls: [],
    });
  });

  it("consumes streamed tool calls with chunked arguments", async () => {
    const result = await consumeChatCompletionStream({
      body: streamFromText([
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"android__tap","arguments":"{\\"x\\":"}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"10,\\"y\\":20}"}}]}}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    });

    assert.deepEqual(result.toolCalls, [
      {
        id: "call_1",
        type: "function",
        function: {
          name: "android__tap",
          arguments: '{"x":10,"y":20}',
        },
      },
    ]);
  });
});

const streamFromText = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
