import type { AutomationAiRunInput } from "../provider/types";
import {
  SCREEN_MUTATING_TOOLS,
  isDangerousAdbShellCommand,
  sanitizeAiText,
} from "../observation";
import { isPublicPlanText, normalizePublicAiText } from "./public-text";
import type { AutomationToolEnvelopeResult } from "./types";

export type AssistantContentDecision =
  | {
      action: "empty";
      normalizedText: "";
      nextNoToolPlanContinuations: number;
    }
  | {
      action: "continue-plan" | "recover-no-tool" | "guardrail" | "final";
      normalizedText: string;
      nextNoToolPlanContinuations: number;
    };

export interface ScreenObservationPolicySnapshot {
  uiStatus?: string | null;
  uiNodes?: number | null;
  detections?: number | null;
  screenKind?: string | null;
  visionConfidence?: number | null;
  visionSummary?: string | null;
}

export type ToolFailureCategory =
  | "syntax_error"
  | "not_found"
  | "permission_denied"
  | "timeout"
  | "no_match"
  | "no_effect"
  | "failed";

export interface ToolFailureClassification {
  category: ToolFailureCategory;
  summary: string;
  recoveryHint: string;
}

export interface ToolPreflightGuard {
  blocked: true;
  category: ToolFailureCategory;
  summary: string;
  recoveryHint: string;
}

export interface ToolOutcomeClassification {
  changed: boolean | null;
  category?: ToolFailureCategory;
  summary?: string;
  recoveryHint?: string;
}

export const classifyAssistantResponseContent = ({
  content,
  toolCallCount,
  executedToolCalls,
  noToolPlanContinuations,
  maxNoToolPlanContinuations,
}: {
  content: string;
  toolCallCount: number;
  executedToolCalls: number;
  noToolPlanContinuations: number;
  maxNoToolPlanContinuations: number;
}): AssistantContentDecision => {
  if (!content.trim()) {
    return {
      action: "empty",
      normalizedText: "",
      nextNoToolPlanContinuations: noToolPlanContinuations,
    };
  }

  const normalizedText = normalizePublicAiText(content);
  if (toolCallCount > 0) {
    return {
      action: "continue-plan",
      normalizedText,
      nextNoToolPlanContinuations: 0,
    };
  }

  if (!isPublicPlanText(content)) {
    return {
      action: "final",
      normalizedText,
      nextNoToolPlanContinuations: noToolPlanContinuations,
    };
  }

  if (
    executedToolCalls === 0 &&
    noToolPlanContinuations < maxNoToolPlanContinuations &&
    looksLikePrematureNoToolBlocker(content)
  ) {
    return {
      action: "recover-no-tool",
      normalizedText,
      nextNoToolPlanContinuations: noToolPlanContinuations + 1,
    };
  }

  if (noToolPlanContinuations < maxNoToolPlanContinuations) {
    return {
      action: "continue-plan",
      normalizedText,
      nextNoToolPlanContinuations: noToolPlanContinuations + 1,
    };
  }

  return {
    action: "guardrail",
    normalizedText,
    nextNoToolPlanContinuations: noToolPlanContinuations,
  };
};

const looksLikePrematureNoToolBlocker = (content: string) => {
  const normalized = content.toLowerCase();
  return (
    /\battempted\s*:/.test(normalized) ||
    /\bremaining\s*:/.test(normalized) ||
    /\bno further\b/.test(normalized) ||
    /\bno more\b/.test(normalized) ||
    /\bcannot proceed\b/.test(normalized) ||
    /\bcan't proceed\b/.test(normalized) ||
    /\bnot possible\b/.test(normalized) ||
    /\bblocked\b/.test(normalized)
  );
};

export const shouldObserveAfterTool = ({
  uses,
  toolCall,
}: {
  uses: string;
  toolCall: AutomationToolEnvelopeResult;
}): boolean => {
  if (!SCREEN_MUTATING_TOOLS.has(uses)) {
    return false;
  }

  if (uses !== "android.adbShell") {
    return true;
  }

  const command =
    typeof toolCall.input.command === "string" ? toolCall.input.command : "";
  if (!command.trim()) {
    return true;
  }
  if (toolCall.requiresScreenObservation === false) {
    return false;
  }
  return true;
};

export const preflightToolCall = ({
  uses,
  observation,
}: {
  uses: string;
  observation?: ScreenObservationPolicySnapshot | null;
}): ToolPreflightGuard | null => {
  if (uses !== "android.tapText" && uses !== "android.waitForText") {
    return null;
  }
  const uiStatus = observation?.uiStatus ?? "unavailable";
  const uiNodes = observation?.uiNodes ?? 0;
  if (uiStatus === "available" && uiNodes > 0) {
    return null;
  }
  return {
    blocked: true,
    category: "no_match",
    summary:
      "UI text lookup is unavailable because the latest UI hierarchy is empty or failed.",
    recoveryHint:
      "Use vision/location, normalized coordinates for visible targets, package/state discovery, or ask the user instead of retrying text lookup.",
  };
};

export const blockedToolResult = (
  uses: string,
  toolCall: AutomationToolEnvelopeResult,
) => {
  if (uses !== "android.adbShell") {
    return null;
  }
  const command =
    typeof toolCall.input.command === "string" ? toolCall.input.command : "";
  if (!isDangerousAdbShellCommand(command)) {
    return null;
  }
  return {
    summary:
      "This adbShell command is blocked because it may modify device state dangerously. Ask the user for a safer route.",
    error:
      "Potentially destructive adbShell command blocked during AI automation.",
    expectedIntent: toolCall.intent.length > 0 ? toolCall.intent : undefined,
    expectedOutcome:
      toolCall.expectedOutcome.length > 0
        ? toolCall.expectedOutcome
        : undefined,
    envelopeValid: toolCall.envelopeValid,
  };
};

export const toolAttemptKey = (
  uses: string,
  input: Record<string, unknown>,
): string => `${uses}:${stableStringify(input)}`;

export const repeatedToolAttemptGuard = ({
  attempts,
  threshold = 2,
}: {
  attempts: number;
  threshold?: number;
}): ToolPreflightGuard | null => {
  if (attempts < threshold) {
    return null;
  }
  return {
    blocked: true,
    category: "failed",
    summary:
      "The same tool and arguments already failed on this screen. Repeating it is unlikely to help.",
    recoveryHint:
      "Choose a materially different route: a different tool, different target, navigation step, state-discovery command, or user clarification.",
  };
};

export const classifyToolFailure = ({
  uses,
  message,
  data,
}: {
  uses: string;
  message: string;
  data?: Record<string, unknown>;
}): ToolFailureClassification => {
  if (isToolFailureCategory(data?.failureCategory)) {
    return {
      category: data.failureCategory,
      summary: sanitizeAiText(message || `${uses} failed.`, 500),
      recoveryHint:
        typeof data.recoveryHint === "string"
          ? sanitizeAiText(data.recoveryHint, 500)
          : "Use the latest observation and choose a different confirmed route before retrying.",
    };
  }
  const combined = [
    message,
    typeof data?.stdout === "string" ? data.stdout : "",
    typeof data?.stderr === "string" ? data.stderr : "",
    typeof data?.reason === "string" ? data.reason : "",
  ]
    .join("\n")
    .toLowerCase();

  if (looksLikeShellHelp(combined)) {
    return {
      category: "syntax_error",
      summary: `${uses} failed because Android returned command help instead of executing the request.`,
      recoveryHint:
        "Use a typed tool when available, or revise the shell command syntax instead of repeating the same command.",
    };
  }
  if (
    combined.includes("not found") ||
    combined.includes("no matching") ||
    combined.includes("no activities found") ||
    combined.includes("could not be found")
  ) {
    return {
      category: "not_found",
      summary: `${uses} did not find the requested target.`,
      recoveryHint:
        "Verify the target exists on the current screen/device, discover packages or visible text, or navigate before searching again.",
    };
  }
  if (
    combined.includes("permission denied") ||
    combined.includes("not allowed") ||
    combined.includes("securityexception")
  ) {
    return {
      category: "permission_denied",
      summary: `${uses} was denied by Android permissions or policy.`,
      recoveryHint:
        "Choose a permitted typed tool, visible UI navigation, or ask the user for the missing permission.",
    };
  }
  if (combined.includes("timed out") || combined.includes("timeout")) {
    return {
      category: "timeout",
      summary: `${uses} timed out before reaching the expected state.`,
      recoveryHint:
        "Observe the current screen, then use a different route or a more specific target.",
    };
  }
  if (
    combined.includes("was not found within") ||
    combined.includes("no match")
  ) {
    return {
      category: "no_match",
      summary: `${uses} found no matching visible target.`,
      recoveryHint:
        "Do not retry the same lookup blindly; navigate, use vision/coordinates, or discover state first.",
    };
  }

  return {
    category: "failed",
    summary: sanitizeAiText(message || `${uses} failed.`, 500),
    recoveryHint:
      "Use the latest observation and choose a different confirmed route before retrying.",
  };
};

export const classifyToolOutcome = ({
  uses,
  before,
  after,
}: {
  uses: string;
  before?: ScreenObservationPolicySnapshot | null;
  after?: ScreenObservationPolicySnapshot | null;
}): ToolOutcomeClassification => {
  if (!before || !after || !SCREEN_MUTATING_TOOLS.has(uses)) {
    return { changed: null };
  }
  if (!canCompareScreenState(before, after)) {
    return { changed: null };
  }
  const changed = screenStateSignature(before) !== screenStateSignature(after);
  if (changed) {
    return { changed: true };
  }
  if (
    uses === "android.tap" ||
    uses === "android.tapNormalized" ||
    uses === "android.swipe" ||
    uses === "android.swipeNormalized" ||
    uses === "android.key" ||
    uses === "android.launchPackage" ||
    uses === "android.expandNotifications" ||
    uses === "android.expandQuickSettings" ||
    uses === "android.collapsePanels"
  ) {
    return {
      changed: false,
      category: "no_effect",
      summary: `${uses} completed, but the observed screen state did not change.`,
      recoveryHint:
        "Treat the action as unconfirmed. Do not repeat the same action; choose a different target, navigation route, typed tool, or ask the user.",
    };
  }
  return { changed: false };
};

export const parseToolCallArguments = (
  uses: string,
  rawArguments: Record<string, unknown>,
): AutomationToolEnvelopeResult => {
  if (!isObjectRecord(rawArguments)) {
    return {
      intent: `Legacy tool call shape for ${uses}.`,
      expectedOutcome: "Model returned a malformed tool argument object.",
      input: {},
      envelopeValid: false,
    };
  }
  const hasEnvelope =
    typeof rawArguments.intent === "string" &&
    typeof rawArguments.expectedOutcome === "string" &&
    rawArguments.input != null &&
    typeof rawArguments.input === "object" &&
    !Array.isArray(rawArguments.input);
  const requiresScreenObservation =
    typeof rawArguments.requiresScreenObservation === "boolean"
      ? rawArguments.requiresScreenObservation
      : undefined;
  const requiresScreenObservationWellFormed =
    uses !== "android.adbShell"
      ? true
      : rawArguments.requiresScreenObservation === undefined ||
        typeof rawArguments.requiresScreenObservation === "boolean";
  if (!hasEnvelope) {
    const legacyInput = isObjectRecord(rawArguments.input)
      ? rawArguments.input
      : rawArguments;
    return {
      intent:
        typeof rawArguments.intent === "string"
          ? sanitizeAiText(rawArguments.intent, 140)
          : `Legacy tool call for ${uses}.`,
      expectedOutcome:
        typeof rawArguments.expectedOutcome === "string"
          ? sanitizeAiText(rawArguments.expectedOutcome, 220)
          : "No explicit expected outcome was supplied.",
      input: legacyInput,
      requiresScreenObservation: uses === "android.adbShell" ? true : undefined,
      envelopeValid: false,
    };
  }
  return {
    intent: sanitizeAiText(rawArguments.intent, 140),
    expectedOutcome: sanitizeAiText(rawArguments.expectedOutcome, 220),
    input: rawArguments.input as Record<string, unknown>,
    requiresScreenObservation:
      uses === "android.adbShell"
        ? (requiresScreenObservation ?? true)
        : undefined,
    envelopeValid: hasEnvelope && requiresScreenObservationWellFormed,
  };
};

export const applyRunVisionDefaults = (
  uses: string,
  toolCall: AutomationToolEnvelopeResult,
  input: Pick<AutomationAiRunInput, "visionProviderId" | "visionModelId">,
): AutomationToolEnvelopeResult => {
  if (uses !== "vision.observe" && uses !== "vision.locate") {
    return toolCall;
  }
  const nextInput = { ...toolCall.input };
  if (
    input.visionProviderId &&
    typeof nextInput.visionProviderId !== "string"
  ) {
    nextInput.visionProviderId = input.visionProviderId;
  }
  if (input.visionModelId && typeof nextInput.visionModelId !== "string") {
    nextInput.visionModelId = input.visionModelId;
  }
  return { ...toolCall, input: nextInput };
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === "object" && !Array.isArray(value);

const toolFailureCategories = new Set<ToolFailureCategory>([
  "syntax_error",
  "not_found",
  "permission_denied",
  "timeout",
  "no_match",
  "no_effect",
  "failed",
]);

const isToolFailureCategory = (value: unknown): value is ToolFailureCategory =>
  typeof value === "string" &&
  toolFailureCategories.has(value as ToolFailureCategory);

const looksLikeShellHelp = (text: string) =>
  /\busage:\s/.test(text) ||
  /\bcommands:\s/.test(text) ||
  text.includes("print this help text") ||
  text.includes("no service specified; use -l to list");

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
};

const canCompareScreenState = (
  before: ScreenObservationPolicySnapshot,
  after: ScreenObservationPolicySnapshot,
) =>
  before.uiStatus != null ||
  after.uiStatus != null ||
  before.detections != null ||
  after.detections != null ||
  before.screenKind != null ||
  after.screenKind != null ||
  before.visionSummary != null ||
  after.visionSummary != null;

const screenStateSignature = (snapshot: ScreenObservationPolicySnapshot) =>
  stableStringify({
    uiStatus: snapshot.uiStatus ?? null,
    uiNodes: snapshot.uiNodes ?? null,
    detections: snapshot.detections ?? null,
    screenKind: snapshot.screenKind ?? null,
    visionSummary: normalizeVisionSummary(snapshot.visionSummary),
  });

const normalizeVisionSummary = (value?: string | null) =>
  value
    ? value
        .toLowerCase()
        .replace(/\b\d{1,2}:\d{2}\b/g, "<time>")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 600)
    : null;
