import type { ChatToolCall } from '../../../common/ai-provider-request';

export const DEVICE_DECISION_TOOL_NAME = 'submit_device_decision';

export type DeviceAgentDecision =
  | {
      kind: 'act';
      snapshotId: string;
      intent: string;
      expectedOutcome: string;
      action: DeviceAgentAction;
    }
  | { kind: 'needs_plan'; reason: string }
  | { kind: 'ask_user'; question: string; reason: string }
  | {
      kind: 'request_escalation';
      reason: string;
      program: string;
      args: string[];
    }
  | {
      kind: 'finish';
      status: 'completed' | 'blocked';
      finalText: string;
      evidenceIds: string[];
      completedSubgoalIds: string[];
      reason?: string;
    };

export type DeviceAgentAction =
  | {
      type: 'tap';
      candidateId?: string;
      point?: { x: number; y: number };
    }
  | {
      type: 'swipe';
      start: { x: number; y: number };
      end: { x: number; y: number };
      durationMs?: number;
    }
  | { type: 'input_text'; text: string }
  | { type: 'key'; key: string }
  | { type: 'launch_app'; packageName: string }
  | {
      type: 'open_system_surface';
      surface: 'settings' | 'notifications' | 'quick_settings' | 'home';
    }
  | { type: 'wait'; durationMs: number }
  | { type: 'invoke_capability'; uses: string; input: Record<string, unknown> };

const pointSchema = {
  type: 'object',
  properties: {
    x: { type: 'number', minimum: 0, maximum: 1 },
    y: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['x', 'y'],
  additionalProperties: false,
};

const actionSchema = {
  oneOf: [
    {
      type: 'object',
      properties: {
        type: { const: 'tap' },
        candidateId: { type: 'string', minLength: 1, maxLength: 120 },
        point: pointSchema,
      },
      required: ['type'],
      anyOf: [{ required: ['candidateId'] }, { required: ['point'] }],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'swipe' },
        start: pointSchema,
        end: pointSchema,
        durationMs: { type: 'integer', minimum: 50, maximum: 5000 },
      },
      required: ['type', 'start', 'end'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'input_text' },
        text: { type: 'string', maxLength: 4000 },
      },
      required: ['type', 'text'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'key' },
        key: { type: 'string', minLength: 1, maxLength: 80 },
      },
      required: ['type', 'key'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'launch_app' },
        packageName: { type: 'string', minLength: 1, maxLength: 255 },
      },
      required: ['type', 'packageName'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'open_system_surface' },
        surface: {
          enum: ['settings', 'notifications', 'quick_settings', 'home'],
        },
      },
      required: ['type', 'surface'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'wait' },
        durationMs: { type: 'integer', minimum: 100, maximum: 30000 },
      },
      required: ['type', 'durationMs'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { const: 'invoke_capability' },
        uses: { type: 'string', minLength: 1, maxLength: 120 },
        input: { type: 'object' },
      },
      required: ['type', 'uses', 'input'],
      additionalProperties: false,
    },
  ],
};

export const deviceDecisionJsonSchema: Record<string, unknown> = {
  type: 'object',
  oneOf: [
    {
      properties: {
        kind: { const: 'act' },
        snapshotId: { type: 'string', minLength: 1, maxLength: 160 },
        intent: { type: 'string', minLength: 1, maxLength: 160 },
        expectedOutcome: { type: 'string', minLength: 1, maxLength: 240 },
        action: actionSchema,
      },
      required: ['kind', 'snapshotId', 'intent', 'expectedOutcome', 'action'],
      additionalProperties: false,
    },
    {
      properties: {
        kind: { const: 'needs_plan' },
        reason: { type: 'string', minLength: 1, maxLength: 500 },
      },
      required: ['kind', 'reason'],
      additionalProperties: false,
    },
    {
      properties: {
        kind: { const: 'ask_user' },
        question: { type: 'string', minLength: 1, maxLength: 500 },
        reason: { type: 'string', minLength: 1, maxLength: 500 },
      },
      required: ['kind', 'question', 'reason'],
      additionalProperties: false,
    },
    {
      properties: {
        kind: { const: 'request_escalation' },
        reason: { type: 'string', minLength: 1, maxLength: 500 },
        program: { type: 'string', minLength: 1, maxLength: 80 },
        args: {
          type: 'array',
          items: { type: 'string', maxLength: 500 },
          maxItems: 20,
        },
      },
      required: ['kind', 'reason', 'program', 'args'],
      additionalProperties: false,
    },
    {
      properties: {
        kind: { const: 'finish' },
        status: { enum: ['completed', 'blocked'] },
        finalText: { type: 'string', minLength: 1, maxLength: 4000 },
        evidenceIds: {
          type: 'array',
          items: { type: 'string', minLength: 1, maxLength: 160 },
          maxItems: 20,
        },
        completedSubgoalIds: {
          type: 'array',
          items: { type: 'string', minLength: 1, maxLength: 120 },
          maxItems: 6,
        },
        reason: { type: 'string', maxLength: 1000 },
      },
      required: [
        'kind',
        'status',
        'finalText',
        'evidenceIds',
        'completedSubgoalIds',
      ],
      additionalProperties: false,
    },
  ],
};

export const buildDeviceDecisionTool = () => ({
  type: 'function' as const,
  function: {
    name: DEVICE_DECISION_TOOL_NAME,
    description:
      'Submit exactly one grounded device action or one terminal/control decision.',
    parameters: deviceDecisionJsonSchema,
  },
});

export const parseDeviceAgentDecision = ({
  content,
  defaultSnapshotId,
  toolCalls,
}: {
  content: string;
  defaultSnapshotId?: string;
  toolCalls?: ChatToolCall[];
}): DeviceAgentDecision => {
  const decisionCall = toolCalls?.find(
    (call) => call.function.name === DEVICE_DECISION_TOOL_NAME,
  );
  const raw = decisionCall?.function.arguments || extractJsonObject(content);
  if (!raw) throw new Error('Provider returned no device decision JSON.');
  const parsed = parseJsonLike(raw);
  if (parsed === null) {
    throw new Error('Provider returned malformed device decision JSON.');
  }
  const normalized = normalizeDeviceDecision(parsed, defaultSnapshotId);
  if (!isDeviceAgentDecision(normalized)) {
    throw new Error(invalidDecisionMessage(normalized));
  }
  return normalized;
};

const extractJsonObject = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced?.startsWith('{') && fenced.endsWith('}')) return fenced;
  return firstBalancedObject(trimmed);
};

const parseJsonLike = (value: unknown, depth = 0): unknown | null => {
  if (depth > 3) return null;
  if (typeof value !== 'string') return value;
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'string'
      ? parseJsonLike(parsed, depth + 1)
      : parsed;
  } catch {
    return null;
  }
};

const normalizeDeviceDecision = (
  value: unknown,
  defaultSnapshotId?: string,
): unknown => {
  const unwrapped = unwrapDecision(value);
  const decision = objectValue(unwrapped);
  if (!decision) return unwrapped;
  const inferredKind = decisionKind(decision);
  if (inferredKind === 'act') {
    const actionSource = objectValue(decision.action) ?? decision;
    const action = normalizeAction(actionSource);
    const actionType = objectValue(action)?.type;
    const intent = firstText(decision.intent, decision.reason);
    return {
      kind: 'act',
      snapshotId:
        firstText(decision.snapshotId, decision.snapshot_id) ??
        defaultSnapshotId ??
        '',
      intent:
        intent ??
        (typeof actionType === 'string'
          ? `Perform ${actionType.replaceAll('_', ' ')}`
          : 'Perform the next grounded action'),
      expectedOutcome:
        firstText(decision.expectedOutcome, decision.expected_outcome) ??
        intent ??
        'The requested device state changes visibly',
      action,
    };
  }
  if (inferredKind === 'needs_plan') {
    return {
      kind: 'needs_plan',
      reason:
        firstText(decision.reason, decision.message) ??
        'A higher-level plan is needed.',
    };
  }
  if (inferredKind === 'ask_user') {
    const question = firstText(decision.question, decision.message) ?? '';
    return {
      kind: 'ask_user',
      question,
      reason: firstText(decision.reason) ?? question,
    };
  }
  if (inferredKind === 'request_escalation') {
    return {
      kind: 'request_escalation',
      reason:
        firstText(decision.reason, decision.message) ??
        'A read-only diagnostic is required.',
      program: firstText(decision.program) ?? '',
      args: stringArray(decision.args),
    };
  }
  if (inferredKind === 'finish') {
    const status = decision.status;
    return {
      kind: 'finish',
      status,
      finalText:
        firstText(decision.finalText, decision.final_text, decision.message) ??
        '',
      evidenceIds: stringArray(decision.evidenceIds ?? decision.evidence_ids),
      completedSubgoalIds: stringArray(
        decision.completedSubgoalIds ?? decision.completed_subgoal_ids,
      ),
      ...(firstText(decision.reason)
        ? { reason: firstText(decision.reason) }
        : {}),
    };
  }
  return decision;
};

const unwrapDecision = (value: unknown, depth = 0): unknown => {
  if (depth > 4) return value;
  const parsed = parseJsonLike(value);
  if (parsed === null) return value;
  if (Array.isArray(parsed) && parsed.length === 1) {
    return unwrapDecision(parsed[0], depth + 1);
  }
  const wrapper = objectValue(parsed);
  if (!wrapper) return parsed;
  const functionRecord = objectValue(wrapper.function);
  if (
    functionRecord?.arguments !== undefined &&
    functionRecord.name === DEVICE_DECISION_TOOL_NAME
  ) {
    return unwrapDecision(functionRecord.arguments, depth + 1);
  }
  if (
    wrapper.arguments !== undefined &&
    (wrapper.name === DEVICE_DECISION_TOOL_NAME || wrapper.name === undefined)
  ) {
    return unwrapDecision(wrapper.arguments, depth + 1);
  }
  for (const key of ['decision', 'deviceDecision', 'device_decision']) {
    const nested = wrapper[key];
    if (
      objectValue(nested) ||
      Array.isArray(nested) ||
      (typeof nested === 'string' && nested.trim().startsWith('{'))
    ) {
      return unwrapDecision(nested, depth + 1);
    }
  }
  return wrapper;
};

const decisionKind = (decision: Record<string, unknown>) => {
  const rawKind = firstText(decision.kind, decision.decision);
  if (rawKind === 'action') return 'act';
  if (rawKind === 'plan') return 'needs_plan';
  if (rawKind === 'done') return 'finish';
  if (
    rawKind === 'act' ||
    rawKind === 'needs_plan' ||
    rawKind === 'ask_user' ||
    rawKind === 'request_escalation' ||
    rawKind === 'finish'
  ) {
    return rawKind;
  }
  if (
    objectValue(decision.action) ||
    normalizedActionType(decision.action) ||
    normalizedActionType(decision.type)
  ) {
    return 'act';
  }
  if (decision.status === 'completed' || decision.status === 'blocked') {
    return 'finish';
  }
  if (nonEmptyString(decision.question)) return 'ask_user';
  if (nonEmptyString(decision.program)) return 'request_escalation';
  return null;
};

const normalizeAction = (value: Record<string, unknown>): unknown => {
  const parameters =
    objectValue(value.parameters) ?? objectValue(value.params) ?? {};
  const source = { ...value, ...parameters };
  const type = normalizedActionType(
    source.type ?? source.action ?? source.name,
  );
  if (!type) return source;
  if (type === 'tap') {
    const directPoint =
      normalizedNumber(source.x) && normalizedNumber(source.y)
        ? { x: source.x, y: source.y }
        : null;
    const point =
      objectValue(source.point) ??
      objectValue(source.coordinates) ??
      directPoint;
    return {
      type,
      ...(firstText(
        source.candidateId,
        source.candidate_id,
        source.targetId,
        source.target_id,
      )
        ? {
            candidateId: firstText(
              source.candidateId,
              source.candidate_id,
              source.targetId,
              source.target_id,
            ),
          }
        : {}),
      ...(point ? { point } : {}),
    };
  }
  if (type === 'swipe') {
    return {
      type,
      start: source.start,
      end: source.end,
      ...(positiveNumber(source.durationMs ?? source.duration_ms)
        ? { durationMs: source.durationMs ?? source.duration_ms }
        : {}),
    };
  }
  if (type === 'input_text') {
    return { type, text: firstText(source.text, source.value) ?? '' };
  }
  if (type === 'key') {
    return { type, key: firstText(source.key, source.value) ?? '' };
  }
  if (type === 'launch_app') {
    return {
      type,
      packageName:
        firstText(source.packageName, source.package_name, source.package) ??
        '',
    };
  }
  if (type === 'open_system_surface') {
    return { type, surface: source.surface };
  }
  if (type === 'wait') {
    return { type, durationMs: source.durationMs ?? source.duration_ms };
  }
  return {
    type,
    uses: firstText(source.uses, source.tool) ?? '',
    input: objectValue(source.input) ?? {},
  };
};

const normalizedActionType = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const aliases: Record<string, DeviceAgentAction['type']> = {
    click: 'tap',
    inputText: 'input_text',
    launch: 'launch_app',
    launchPackage: 'launch_app',
    open_app: 'launch_app',
    openSystemSurface: 'open_system_surface',
    invokeCapability: 'invoke_capability',
  };
  const normalized = aliases[value.trim()] ?? value.trim();
  return isActionType(normalized) ? normalized : null;
};

const isActionType = (value: unknown): value is DeviceAgentAction['type'] =>
  typeof value === 'string' &&
  [
    'tap',
    'swipe',
    'input_text',
    'key',
    'launch_app',
    'open_system_surface',
    'wait',
    'invoke_capability',
  ].includes(value);

const invalidDecisionMessage = (value: unknown) => {
  const decision = objectValue(value);
  if (!decision) return 'Provider returned an invalid device decision shape.';
  if (decision.kind === 'act' && !isDeviceAction(decision.action)) {
    return 'Provider returned an ungrounded action. A tap must include action.candidateId from the current observation or action.point with normalized x/y coordinates.';
  }
  if (decision.kind === 'act' && !nonEmptyString(decision.snapshotId)) {
    return 'Provider omitted the current snapshot ID from its action.';
  }
  if (decision.kind === 'finish') {
    return 'Provider returned an incomplete completion decision.';
  }
  return 'Provider returned an invalid device decision. Use one of: act, needs_plan, ask_user, request_escalation, or finish.';
};

const firstBalancedObject = (value: string) => {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '{') {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }
    if (character === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) return value.slice(start, index + 1);
    }
  }
  return '';
};

const isDeviceAgentDecision = (
  value: unknown,
): value is DeviceAgentDecision => {
  const decision = objectValue(value);
  if (!decision || typeof decision.kind !== 'string') return false;
  if (decision.kind === 'act') {
    return (
      nonEmptyString(decision.snapshotId) &&
      nonEmptyString(decision.intent) &&
      nonEmptyString(decision.expectedOutcome) &&
      isDeviceAction(decision.action)
    );
  }
  if (decision.kind === 'needs_plan') return nonEmptyString(decision.reason);
  if (decision.kind === 'ask_user') {
    return nonEmptyString(decision.question) && nonEmptyString(decision.reason);
  }
  if (decision.kind === 'request_escalation') {
    return (
      nonEmptyString(decision.reason) &&
      nonEmptyString(decision.program) &&
      Array.isArray(decision.args) &&
      decision.args.every((arg) => typeof arg === 'string')
    );
  }
  if (decision.kind === 'finish') {
    return (
      (decision.status === 'completed' || decision.status === 'blocked') &&
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
  if (!action || typeof action.type !== 'string') return false;
  if (action.type === 'tap') {
    return nonEmptyString(action.candidateId) || isPoint(action.point);
  }
  if (action.type === 'swipe') {
    return isPoint(action.start) && isPoint(action.end);
  }
  if (action.type === 'input_text') return typeof action.text === 'string';
  if (action.type === 'key') return nonEmptyString(action.key);
  if (action.type === 'launch_app') return nonEmptyString(action.packageName);
  if (action.type === 'open_system_surface') {
    return ['settings', 'notifications', 'quick_settings', 'home'].includes(
      String(action.surface),
    );
  }
  if (action.type === 'wait') return positiveNumber(action.durationMs);
  if (action.type === 'invoke_capability') {
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
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const firstText = (...values: unknown[]) => {
  const value = values.find(nonEmptyString);
  return typeof value === 'string' ? value.trim() : null;
};
const stringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => nonEmptyString(item))
    : [];
const positiveNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;
const normalizedNumber = (value: unknown) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;
