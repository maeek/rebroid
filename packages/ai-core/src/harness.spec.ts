import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  allowedToolMatcher,
  buildChatRequestBody,
  buildExecutePlanMessage,
  buildFinalRecoveryMessage,
  buildInitialMessages,
  buildMalformedToolCallRecoveryMessage,
  buildNoToolActionRecoveryMessage,
  buildPublicPlanRequestMessage,
  buildReplanMessage,
  buildUiXmlObservationMessage,
  buildToolDefinitions,
  chatCompletionsEndpoint,
  consumeChatCompletionStream,
  isPublicPlanText,
  applyRunVisionDefaults,
  blockedToolResult,
  classifyToolFailure,
  classifyToolOutcome,
  classifyAssistantResponseContent,
  correctScreenStateHypothesis,
  isSettingsOpenClaimConfirmed,
  mapUsesByToolName,
  normalizePublicAiText,
  parseArguments,
  parseToolCallArguments,
  preflightToolCall,
  repeatedToolAttemptGuard,
  shouldObserveAfterTool,
  toolAttemptKey,
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
  defaultFor: ["planner"],
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
    assert.ok(
      typeof initialMessages[0].content === "string" &&
        initialMessages[0].content.includes(
          "Do not identify unlabeled launcher icons as Settings",
        ),
    );
    assert.ok(
      typeof initialMessages[0].content === "string" &&
        initialMessages[0].content.includes("android.expandQuickSettings"),
    );
    assert.deepEqual(initialMessages[1], { role: "user", content: "Do it" });
    assert.deepEqual(
      buildInitialMessages(
        {
          prompt: "Do it",
          initialScreenshotDataUrl: "data:image/png;base64,abc",
          initialObservationText: "Screen observation",
        },
        model,
      )[1],
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Do it\n\nCurrent screen observation:\nScreen observation\n\nCurrent screenshot is attached. Inspect both before taking any action.",
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

  it("corrects quick-settings screens mislabeled as Settings", () => {
    const corrected = correctScreenStateHypothesis({
      screenKind: "settings_app",
      confidence: 0.9,
      visibleText: ["Internet", "Bluetooth", "Battery Saver"],
      controls: [{ label: "Settings gear", role: "icon" }],
      evidence: ["Brightness slider and quick settings tiles visible."],
      uncertainty: [],
      summary: "Settings app opened.",
    });

    assert.equal(corrected.screenKind, "quick_settings");
    assert.equal(corrected.settingsAccessVisible, true);
    assert.ok(corrected.confidence < 0.9);
    assert.ok(corrected.correctionReason?.includes("internet"));
  });

  it("does not treat quick settings as confirmed Settings app completion", () => {
    assert.equal(
      isSettingsOpenClaimConfirmed({
        screenKind: "quick_settings",
        confirmedFacts: [],
        visibleText: ["Internet", "Bluetooth"],
      }),
      false,
    );
    assert.equal(
      isSettingsOpenClaimConfirmed({
        screenKind: "settings_app",
        confirmedFacts: [
          "android.openSystemSettings opened the Android Settings main screen.",
        ],
        visibleText: [],
      }),
      true,
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
    assert.ok(planContent.includes("Do not label generic Android robot"));
    assert.ok(planContent.includes("android.expandQuickSettings"));
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
    assert.ok(replanContent.includes("Do not retry guessed coordinate taps"));
    assert.ok(replanContent.includes("android.expandNotifications"));

    const recoveryMessage = buildFinalRecoveryMessage({
      prompt: "Turn on dark mode",
    });
    assert.equal(recoveryMessage.role, "user");
    const recoveryContent =
      typeof recoveryMessage.content === "string"
        ? recoveryMessage.content
        : "";
    assert.ok(recoveryContent.includes("final answer"));

    const noToolRecoveryMessage = buildNoToolActionRecoveryMessage({
      prompt: "Turn on dark mode",
    });
    const noToolRecoveryContent =
      typeof noToolRecoveryMessage.content === "string"
        ? noToolRecoveryMessage.content
        : "";
    assert.ok(noToolRecoveryContent.includes("no tool has been called"));
    assert.ok(noToolRecoveryContent.includes("android.openSystemSettings"));

    const malformedToolCallRecovery = buildMalformedToolCallRecoveryMessage();
    const malformedToolCallRecoveryContent =
      typeof malformedToolCallRecovery.content === "string"
        ? malformedToolCallRecovery.content
        : "";
    assert.ok(
      malformedToolCallRecoveryContent.includes(
        "malformed JSON. No tool was executed",
      ),
    );
    assert.ok(
      malformedToolCallRecoveryContent.includes(
        '"intent":"short action","expectedOutcome":"verifiable result","input":{...}',
      ),
    );
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

  it("normalizes plain public plan labels into markdown bullets", () => {
    const text = [
      "Current screen: Home screen with search bar",
      "Goal: Turn on dark mode theme",
      "Next moves: Locate Settings using typed tools",
      "First action: List installed packages",
      "Replan if: Settings is missing",
    ].join("\n");

    assert.equal(
      normalizePublicAiText(text),
      [
        "- **Current screen:** Home screen with search bar",
        "- **Goal:** Turn on dark mode theme",
        "- **Next moves:** Locate Settings using typed tools",
        "- **First action:** List installed packages",
        "- **Replan if:** Settings is missing",
      ].join("\n"),
    );
    assert.equal(isPublicPlanText(text), true);
  });

  it("normalizes bare bold public plan labels into markdown bullets", () => {
    const text = [
      "**Current screen:** Home screen",
      "**Goal:** Enable dark mode",
      "**Result:** Not complete yet",
    ].join("\n");

    assert.equal(
      normalizePublicAiText(text),
      [
        "- **Current screen:** Home screen",
        "- **Goal:** Enable dark mode",
        "- **Result:** Not complete yet",
      ].join("\n"),
    );
  });

  it("classifies no-tool public plans as continuations before the guardrail limit", () => {
    assert.deepEqual(
      classifyAssistantResponseContent({
        content: "Current screen: Home\nGoal: Inspect packages",
        toolCallCount: 0,
        executedToolCalls: 0,
        noToolPlanContinuations: 0,
        maxNoToolPlanContinuations: 3,
      }),
      {
        action: "continue-plan",
        normalizedText:
          "- **Current screen:** Home\n- **Goal:** Inspect packages",
        nextNoToolPlanContinuations: 1,
      },
    );
  });

  it("classifies repeated no-tool public plans as a guardrail", () => {
    assert.deepEqual(
      classifyAssistantResponseContent({
        content: "Current screen: Home\nGoal: Inspect packages",
        toolCallCount: 0,
        executedToolCalls: 1,
        noToolPlanContinuations: 3,
        maxNoToolPlanContinuations: 3,
      }),
      {
        action: "guardrail",
        normalizedText:
          "- **Current screen:** Home\n- **Goal:** Inspect packages",
        nextNoToolPlanContinuations: 3,
      },
    );
  });

  it("classifies no-tool non-plan content as final text", () => {
    assert.deepEqual(
      classifyAssistantResponseContent({
        content: "Package list was inspected.",
        toolCallCount: 0,
        executedToolCalls: 1,
        noToolPlanContinuations: 1,
        maxNoToolPlanContinuations: 3,
      }),
      {
        action: "final",
        normalizedText: "Package list was inspected.",
        nextNoToolPlanContinuations: 1,
      },
    );
  });

  it("classifies tool-bearing content as progress and resets plan continuation count", () => {
    assert.deepEqual(
      classifyAssistantResponseContent({
        content: "Next action: list packages",
        toolCallCount: 1,
        executedToolCalls: 0,
        noToolPlanContinuations: 2,
        maxNoToolPlanContinuations: 3,
      }),
      {
        action: "continue-plan",
        normalizedText: "Next action: list packages",
        nextNoToolPlanContinuations: 0,
      },
    );
  });

  it("classifies a no-tool attempted blocker as recoverable before any tool runs", () => {
    assert.deepEqual(
      classifyAssistantResponseContent({
        content: [
          "Current screen: Home screen",
          "Goal: Turn on dark mode theme",
          "Attempted: Opened Settings app.",
          "Remaining: No further tool actions possible.",
        ].join("\n"),
        toolCallCount: 0,
        executedToolCalls: 0,
        noToolPlanContinuations: 0,
        maxNoToolPlanContinuations: 3,
      }),
      {
        action: "recover-no-tool",
        normalizedText: [
          "- **Current screen:** Home screen",
          "- **Goal:** Turn on dark mode theme",
          "- **Attempted:** Opened Settings app.",
          "- **Remaining:** No further tool actions possible.",
        ].join("\n"),
        nextNoToolPlanContinuations: 1,
      },
    );
  });

  it("applies tool policy for observation, legacy arguments, vision defaults, and shell blocking", () => {
    assert.equal(
      shouldObserveAfterTool({
        uses: "android.adbShell",
        toolCall: {
          intent: "Inspect",
          expectedOutcome: "Read package output",
          input: { command: "pm list packages" },
          requiresScreenObservation: false,
          envelopeValid: true,
        },
      }),
      false,
    );
    assert.equal(
      shouldObserveAfterTool({
        uses: "android.tap",
        toolCall: {
          intent: "Tap",
          expectedOutcome: "Open target",
          input: { x: 0.5, y: 0.5 },
          envelopeValid: true,
        },
      }),
      true,
    );
    assert.equal(
      shouldObserveAfterTool({
        uses: "android.expandQuickSettings",
        toolCall: {
          intent: "Open quick settings",
          expectedOutcome: "Quick settings panel is visible",
          input: {},
          envelopeValid: true,
        },
      }),
      true,
    );

    const legacy = parseToolCallArguments("vision.locate", {
      query: "Downloads",
      maxResults: 3,
    });
    assert.equal(legacy.envelopeValid, false);
    assert.deepEqual(legacy.input, { query: "Downloads", maxResults: 3 });

    assert.deepEqual(
      applyRunVisionDefaults(
        "vision.locate",
        {
          intent: "Find downloads",
          expectedOutcome: "Downloads text is located",
          input: { query: "Downloads" },
          envelopeValid: false,
        },
        { visionProviderId: "vision-provider", visionModelId: "vision-model" },
      ).input,
      {
        query: "Downloads",
        visionProviderId: "vision-provider",
        visionModelId: "vision-model",
      },
    );

    assert.equal(
      blockedToolResult("android.adbShell", {
        intent: "Install app",
        expectedOutcome: "App is installed",
        input: { command: "pm install /sdcard/app.apk" },
        envelopeValid: true,
      })?.error,
      "Potentially destructive adbShell command blocked during AI automation.",
    );
  });

  it("blocks text tools when UI hierarchy is unavailable", () => {
    assert.deepEqual(
      preflightToolCall({
        uses: "android.tapText",
        observation: {
          uiStatus: "empty",
          uiNodes: 0,
          detections: 0,
        },
      }),
      {
        blocked: true,
        category: "no_match",
        summary:
          "UI text lookup is unavailable because the latest UI hierarchy is empty or failed.",
        recoveryHint:
          "Use vision/location, normalized coordinates for visible targets, package/state discovery, or ask the user instead of retrying text lookup.",
      },
    );
    assert.equal(
      preflightToolCall({
        uses: "android.tapText",
        observation: { uiStatus: "available", uiNodes: 3 },
      }),
      null,
    );
  });

  it("classifies repeated failed tool attempts", () => {
    assert.equal(
      toolAttemptKey("vision.locate", { maxResults: 1, query: "Settings" }),
      toolAttemptKey("vision.locate", { query: "Settings", maxResults: 1 }),
    );
    assert.equal(repeatedToolAttemptGuard({ attempts: 0, threshold: 1 }), null);
    assert.deepEqual(repeatedToolAttemptGuard({ attempts: 1, threshold: 1 }), {
      blocked: true,
      category: "failed",
      summary:
        "The same tool and arguments already failed on this screen. Repeating it is unlikely to help.",
      recoveryHint:
        "Choose a materially different route: a different tool, different target, navigation step, state-discovery command, or user clarification.",
    });
  });

  it("classifies shell help output as a syntax failure", () => {
    assert.deepEqual(
      classifyToolFailure({
        uses: "android.adbShell",
        message: "Shell command failed with exit code 255.",
        data: {
          stdout:
            "Activity manager (activity) commands:\n  help\n    Print this help text.",
          exitCode: 255,
        },
      }),
      {
        category: "syntax_error",
        summary:
          "android.adbShell failed because Android returned command help instead of executing the request.",
        recoveryHint:
          "Use a typed tool when available, or revise the shell command syntax instead of repeating the same command.",
      },
    );
  });

  it("classifies unchanged screen state after mutating actions as no effect", () => {
    assert.deepEqual(
      classifyToolOutcome({
        uses: "android.tapNormalized",
        before: {
          uiStatus: "empty",
          uiNodes: 0,
          detections: 0,
          screenKind: "home",
          visionSummary: "Home screen with gallery icon",
        },
        after: {
          uiStatus: "empty",
          uiNodes: 0,
          detections: 0,
          screenKind: "home",
          visionSummary: "Home screen with gallery icon",
        },
      }),
      {
        changed: false,
        category: "no_effect",
        summary:
          "android.tapNormalized completed, but the observed screen state did not change.",
        recoveryHint:
          "Treat the action as unconfirmed. Do not repeat the same action; choose a different target, navigation route, typed tool, or ask the user.",
      },
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
