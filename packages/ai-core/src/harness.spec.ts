import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  allowedToolMatcher,
  buildChatRequestBody,
  buildInitialMessages,
  buildUiXmlObservationMessage,
  buildToolDefinitions,
  chatCompletionsEndpoint,
  consumeChatCompletionStream,
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
          "You are an Android automation agent controlling a live device through typed tools.\nAlways inspect the latest structured screen observation before choosing screen actions.\nUse only the tools provided to you. Do not invent tool results or assume an action succeeded without observing the screen again.\nAfter every screen-changing action, wait for the fresh observation before deciding the next action.\nPrefer semantic, vision.locate, or state-reading tools when they are available.\nUse runtime context and android.listPackages to discover installed packages. Do not guess package names for apps that are not listed or otherwise confirmed.\nUse android.launchPackage to open an installed Android package. If it reports that the package is missing or cannot be launched, do not retry the same package blindly; inspect the screen or choose another route.\nNever install Android applications or packages. If a required app is missing, stop the evaluation and ask the user to install or provide the app instead of trying to install it yourself.\nIf UI XML and vision observations do not provide enough visible context, say what context is missing and ask the user instead of guessing.\nUse normalized 0..1 coordinates for screen actions. Prefer android.tapNormalized and android.swipeNormalized over raw pixel coordinates.\nandroid.tapText depends on Android UI hierarchy XML. If the latest observation says the UI hierarchy is empty or failed, use vision.locate, screenshot-derived targets, or normalized coordinates instead.\nTool failures are observations. If one tool fails, use the failure message and latest screen state to decide whether to continue, try a different tool, or stop with a clear final answer.\nUse android.adbShell only when no typed tool can do the job. If reading Android settings, use the exact syntax: settings get <namespace> <key>, for example settings get global zen_mode.\nContinue the observe/action/observe loop until the requested task is visibly complete, the app blocks progress, or a timeout/tool limit is reached.\nWrite concise visible progress and a short final answer. Do not reveal hidden reasoning.\n\nUse terse summaries.",
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
      buildInitialMessages({ prompt: "Do it", initialUiXml: "<hierarchy />" }, model)[1],
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

  it("parses tool arguments defensively", () => {
    assert.deepEqual(parseArguments('{"x":1}'), { x: 1 });
    assert.deepEqual(parseArguments("[]"), {});
    assert.deepEqual(parseArguments("bad"), {});
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
