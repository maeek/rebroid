import { DEVICE_DECISION_TOOL_NAME } from './device-decision';

const pointSchema = {
  type: 'object',
  properties: {
    x: { type: 'number', minimum: 0, maximum: 1 },
    y: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['x', 'y'],
  additionalProperties: false,
};

const tapCandidateSchema = { type: 'string', minLength: 1, maxLength: 120 };
const tapTypeSchema = { type: 'string', enum: ['tap'] };
const tapVariants = [
  {
    type: 'object',
    properties: { type: tapTypeSchema, candidateId: tapCandidateSchema },
    required: ['type', 'candidateId'],
    additionalProperties: false,
  },
  {
    type: 'object',
    properties: { type: tapTypeSchema, point: pointSchema },
    required: ['type', 'point'],
    additionalProperties: false,
  },
];

const swipeDurationSchema = { type: 'integer', minimum: 50, maximum: 5000 };
const actionSchema = (structured: boolean) => ({
  anyOf: [
    ...(structured
      ? tapVariants
      : [
          {
            type: 'object',
            properties: {
              type: tapTypeSchema,
              candidateId: tapCandidateSchema,
              point: pointSchema,
            },
            required: ['type'],
            anyOf: [{ required: ['candidateId'] }, { required: ['point'] }],
            additionalProperties: false,
          },
        ]),
    {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['swipe'] },
        start: pointSchema,
        end: pointSchema,
        durationMs: structured
          ? { anyOf: [swipeDurationSchema, { type: 'null' }] }
          : swipeDurationSchema,
      },
      required: ['type', 'start', 'end', ...(structured ? ['durationMs'] : [])],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['input_text'] },
        text: { type: 'string', maxLength: 4000 },
      },
      required: ['type', 'text'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['key'] },
        key: { type: 'string', minLength: 1, maxLength: 80 },
      },
      required: ['type', 'key'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['launch_app'] },
        packageName: { type: 'string', minLength: 1, maxLength: 255 },
      },
      required: ['type', 'packageName'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['open_system_surface'] },
        surface: {
          type: 'string',
          enum: ['settings', 'quick_settings', 'home'],
        },
      },
      required: ['type', 'surface'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['wait'] },
        durationMs: { type: 'integer', minimum: 100, maximum: 30000 },
      },
      required: ['type', 'durationMs'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['invoke_capability'] },
        uses: { type: 'string', minLength: 1, maxLength: 120 },
        ...(structured
          ? {
              inputJson: {
                type: 'string',
                description:
                  'A JSON object serialized as text using the listed capability input schema. Use "{}" for an empty object.',
              },
            }
          : { input: { type: 'object' } }),
      },
      required: ['type', 'uses', structured ? 'inputJson' : 'input'],
      additionalProperties: false,
    },
  ],
});

const decisionVariants = (structured: boolean) => ({
  anyOf: [
    {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['act'] },
        snapshotId: { type: 'string', minLength: 1, maxLength: 160 },
        intent: { type: 'string', minLength: 1, maxLength: 160 },
        expectedOutcome: { type: 'string', minLength: 1, maxLength: 240 },
        action: actionSchema(structured),
      },
      required: ['kind', 'snapshotId', 'intent', 'expectedOutcome', 'action'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['needs_plan'] },
        reason: { type: 'string', minLength: 1, maxLength: 500 },
      },
      required: ['kind', 'reason'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['ask_user'] },
        question: { type: 'string', minLength: 1, maxLength: 500 },
        reason: { type: 'string', minLength: 1, maxLength: 500 },
      },
      required: ['kind', 'question', 'reason'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['request_escalation'] },
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
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['finish'] },
        status: { type: 'string', enum: ['completed', 'blocked'] },
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
        reason: {
          type: structured ? ['string', 'null'] : 'string',
          maxLength: 1000,
        },
      },
      required: [
        'kind',
        'status',
        'finalText',
        'evidenceIds',
        'completedSubgoalIds',
        ...(structured ? ['reason'] : []),
      ],
      additionalProperties: false,
    },
  ],
});

// Strict structured output needs closed objects, so capability-specific
// arguments travel as JSON text in that mode.
const decisionEnvelope = (structured: boolean) => ({
  type: 'object',
  properties: { decision: decisionVariants(structured) },
  required: ['decision'],
  additionalProperties: false,
});

export const deviceDecisionJsonSchema = decisionEnvelope(true);

export const nativeDeviceDecisionJsonSchema = {
  type: 'object',
  oneOf: decisionVariants(false).anyOf,
};

export const buildDeviceDecisionTool = (nativeOllama = false) => ({
  type: 'function' as const,
  function: {
    name: DEVICE_DECISION_TOOL_NAME,
    description:
      'Submit exactly one grounded device action or one terminal/control decision.',
    parameters: nativeOllama
      ? nativeDeviceDecisionJsonSchema
      : decisionEnvelope(false),
  },
});
