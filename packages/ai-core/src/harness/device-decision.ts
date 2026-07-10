import type { ChatToolCall } from "./types";

export const DEVICE_DECISION_TOOL_NAME = "submit_device_decision";

export type DeviceAgentDecision =
  | {
      kind: "act";
      snapshotId: string;
      intent: string;
      expectedOutcome: string;
      action: DeviceAgentAction;
    }
  | { kind: "needs_plan"; reason: string }
  | { kind: "ask_user"; question: string; reason: string }
  | {
      kind: "request_escalation";
      reason: string;
      program: string;
      args: string[];
    }
  | {
      kind: "finish";
      status: "completed" | "blocked";
      finalText: string;
      evidenceIds: string[];
      completedSubgoalIds: string[];
      reason?: string;
    };

export type DeviceAgentAction =
  | {
      type: "tap";
      candidateId?: string;
      point?: { x: number; y: number };
    }
  | {
      type: "swipe";
      start: { x: number; y: number };
      end: { x: number; y: number };
      durationMs?: number;
    }
  | { type: "input_text"; text: string }
  | { type: "key"; key: string }
  | { type: "launch_app"; packageName: string }
  | {
      type: "open_system_surface";
      surface: "settings" | "notifications" | "quick_settings" | "home";
    }
  | { type: "wait"; durationMs: number }
  | { type: "invoke_capability"; uses: string; input: Record<string, unknown> };

const pointSchema = {
  type: "object",
  properties: {
    x: { type: "number", minimum: 0, maximum: 1 },
    y: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["x", "y"],
  additionalProperties: false,
};

const actionSchema = {
  oneOf: [
    {
      type: "object",
      properties: {
        type: { const: "tap" },
        candidateId: { type: "string", minLength: 1, maxLength: 120 },
        point: pointSchema,
      },
      required: ["type"],
      anyOf: [{ required: ["candidateId"] }, { required: ["point"] }],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { const: "swipe" },
        start: pointSchema,
        end: pointSchema,
        durationMs: { type: "integer", minimum: 50, maximum: 5000 },
      },
      required: ["type", "start", "end"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { const: "input_text" },
        text: { type: "string", maxLength: 4000 },
      },
      required: ["type", "text"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { const: "key" },
        key: { type: "string", minLength: 1, maxLength: 80 },
      },
      required: ["type", "key"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { const: "launch_app" },
        packageName: { type: "string", minLength: 1, maxLength: 255 },
      },
      required: ["type", "packageName"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { const: "open_system_surface" },
        surface: {
          enum: ["settings", "notifications", "quick_settings", "home"],
        },
      },
      required: ["type", "surface"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { const: "wait" },
        durationMs: { type: "integer", minimum: 100, maximum: 30000 },
      },
      required: ["type", "durationMs"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { const: "invoke_capability" },
        uses: { type: "string", minLength: 1, maxLength: 120 },
        input: { type: "object" },
      },
      required: ["type", "uses", "input"],
      additionalProperties: false,
    },
  ],
};

export const deviceDecisionJsonSchema: Record<string, unknown> = {
  type: "object",
  oneOf: [
    {
      properties: {
        kind: { const: "act" },
        snapshotId: { type: "string", minLength: 1, maxLength: 160 },
        intent: { type: "string", minLength: 1, maxLength: 160 },
        expectedOutcome: { type: "string", minLength: 1, maxLength: 240 },
        action: actionSchema,
      },
      required: ["kind", "snapshotId", "intent", "expectedOutcome", "action"],
      additionalProperties: false,
    },
    {
      properties: {
        kind: { const: "needs_plan" },
        reason: { type: "string", minLength: 1, maxLength: 500 },
      },
      required: ["kind", "reason"],
      additionalProperties: false,
    },
    {
      properties: {
        kind: { const: "ask_user" },
        question: { type: "string", minLength: 1, maxLength: 500 },
        reason: { type: "string", minLength: 1, maxLength: 500 },
      },
      required: ["kind", "question", "reason"],
      additionalProperties: false,
    },
    {
      properties: {
        kind: { const: "request_escalation" },
        reason: { type: "string", minLength: 1, maxLength: 500 },
        program: { type: "string", minLength: 1, maxLength: 80 },
        args: {
          type: "array",
          items: { type: "string", maxLength: 500 },
          maxItems: 20,
        },
      },
      required: ["kind", "reason", "program", "args"],
      additionalProperties: false,
    },
    {
      properties: {
        kind: { const: "finish" },
        status: { enum: ["completed", "blocked"] },
        finalText: { type: "string", minLength: 1, maxLength: 4000 },
        evidenceIds: {
          type: "array",
          items: { type: "string", minLength: 1, maxLength: 160 },
          maxItems: 20,
        },
        completedSubgoalIds: {
          type: "array",
          items: { type: "string", minLength: 1, maxLength: 120 },
          maxItems: 6,
        },
        reason: { type: "string", maxLength: 1000 },
      },
      required: [
        "kind",
        "status",
        "finalText",
        "evidenceIds",
        "completedSubgoalIds",
      ],
      additionalProperties: false,
    },
  ],
};

export const buildDeviceDecisionTool = () => ({
  type: "function" as const,
  function: {
    name: DEVICE_DECISION_TOOL_NAME,
    description:
      "Submit exactly one grounded device action or one terminal/control decision.",
    parameters: deviceDecisionJsonSchema,
  },
});

export const parseDeviceAgentDecision = ({
  content,
  toolCalls,
}: {
  content: string;
  toolCalls?: ChatToolCall[];
}): DeviceAgentDecision => {
  const decisionCall = toolCalls?.find(
    (call) => call.function.name === DEVICE_DECISION_TOOL_NAME,
  );
  const raw = decisionCall?.function.arguments || extractJsonObject(content);
  if (!raw) throw new Error("Provider returned no device decision JSON.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Provider returned malformed device decision JSON.");
  }
  if (!isDeviceAgentDecision(parsed)) {
    throw new Error("Provider returned an invalid device decision shape.");
  }
  return parsed;
};

const extractJsonObject = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  return fenced?.startsWith("{") && fenced.endsWith("}") ? fenced : "";
};

const isDeviceAgentDecision = (
  value: unknown,
): value is DeviceAgentDecision => {
  const decision = objectValue(value);
  if (!decision || typeof decision.kind !== "string") return false;
  if (decision.kind === "act") {
    return (
      nonEmptyString(decision.snapshotId) &&
      nonEmptyString(decision.intent) &&
      nonEmptyString(decision.expectedOutcome) &&
      isDeviceAction(decision.action)
    );
  }
  if (decision.kind === "needs_plan") return nonEmptyString(decision.reason);
  if (decision.kind === "ask_user") {
    return nonEmptyString(decision.question) && nonEmptyString(decision.reason);
  }
  if (decision.kind === "request_escalation") {
    return (
      nonEmptyString(decision.reason) &&
      nonEmptyString(decision.program) &&
      Array.isArray(decision.args) &&
      decision.args.every((arg) => typeof arg === "string")
    );
  }
  if (decision.kind === "finish") {
    return (
      (decision.status === "completed" || decision.status === "blocked") &&
      nonEmptyString(decision.finalText) &&
      Array.isArray(decision.evidenceIds) &&
      decision.evidenceIds.every(nonEmptyString) &&
      Array.isArray(decision.completedSubgoalIds) &&
      decision.completedSubgoalIds.every(nonEmptyString)
    );
  }
  return false;
};

const isDeviceAction = (value: unknown): value is DeviceAgentAction => {
  const action = objectValue(value);
  if (!action || typeof action.type !== "string") return false;
  if (action.type === "tap") {
    return nonEmptyString(action.candidateId) || isPoint(action.point);
  }
  if (action.type === "swipe") {
    return isPoint(action.start) && isPoint(action.end);
  }
  if (action.type === "input_text") return typeof action.text === "string";
  if (action.type === "key") return nonEmptyString(action.key);
  if (action.type === "launch_app") return nonEmptyString(action.packageName);
  if (action.type === "open_system_surface") {
    return ["settings", "notifications", "quick_settings", "home"].includes(
      String(action.surface),
    );
  }
  if (action.type === "wait") return positiveNumber(action.durationMs);
  if (action.type === "invoke_capability") {
    return nonEmptyString(action.uses) && Boolean(objectValue(action.input));
  }
  return false;
};

const isPoint = (value: unknown) => {
  const point = objectValue(value);
  return (
    point !== null && normalizedNumber(point.x) && normalizedNumber(point.y)
  );
};

const objectValue = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const nonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const positiveNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
const normalizedNumber = (value: unknown) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;
