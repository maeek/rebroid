import type { AutomationCommand } from '@/server/orchestrator/automations/types'

type JsonSchema = Record<string, unknown>

const valueRefSchema: JsonSchema = {
  type: 'object',
  required: ['source'],
  properties: {
    source: { enum: ['literal', 'context', 'step'] },
    value: {},
    path: { type: 'string' },
    stepId: { type: 'string' }
  },
  additionalProperties: false
}

const predicateSchema: JsonSchema = {
  type: 'object',
  required: ['left', 'operator'],
  properties: {
    left: valueRefSchema,
    operator: {
      enum: [
        'equals',
        'notEquals',
        'contains',
        'exists',
        'greaterThan',
        'greaterThanOrEqual',
        'lessThan',
        'lessThanOrEqual',
        'matches'
      ]
    },
    right: valueRefSchema
  },
  additionalProperties: false
}

export const buildAutomationYamlSchema = (commands: AutomationCommand[]): JsonSchema => {
  const actionSteps = commands.map(command => ({
    type: 'object',
    required: ['id', 'uses', 'with'],
    properties: {
      id: { type: 'string' },
      uses: { enum: [command.uses], description: command.description },
      with: command.inputSchema
    },
    additionalProperties: false
  }))

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'rebroid-automation.schema.json',
    title: 'Rebroid automation',
    type: 'object',
    required: ['apiVersion', 'kind', 'metadata', 'spec'],
    properties: {
      apiVersion: { enum: ['rebroid.io/automation/v1'] },
      kind: { enum: ['AndroidAutomation'] },
      metadata: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          tags: {
            type: 'array',
            items: { type: 'string', minLength: 1, maxLength: 48 },
            uniqueItems: true
          }
        },
        additionalProperties: false
      },
      spec: {
        type: 'object',
        required: ['steps'],
        properties: {
          steps: {
            type: 'array',
            minItems: 1,
            items: { $ref: '#/definitions/step' }
          }
        },
        additionalProperties: false
      }
    },
    additionalProperties: false,
    definitions: {
      step: {
        oneOf: [
          ...actionSteps,
          {
            type: 'object',
            required: ['id', 'type', 'condition', 'then'],
            properties: {
              id: { type: 'string' },
              type: { enum: ['condition'] },
              condition: predicateSchema,
              then: { type: 'array', minItems: 1, items: { $ref: '#/definitions/step' } },
              else: { type: 'array', items: { $ref: '#/definitions/step' } }
            },
            additionalProperties: false
          },
          {
            type: 'object',
            required: ['id', 'type', 'value', 'cases'],
            properties: {
              id: { type: 'string' },
              type: { enum: ['switch'] },
              value: valueRefSchema,
              cases: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['value', 'steps'],
                  properties: {
                    value: {},
                    steps: { type: 'array', minItems: 1, items: { $ref: '#/definitions/step' } }
                  },
                  additionalProperties: false
                }
              },
              default: { type: 'array', items: { $ref: '#/definitions/step' } }
            },
            additionalProperties: false
          },
          {
            type: 'object',
            required: ['id', 'type', 'maxIterations', 'steps'],
            properties: {
              id: { type: 'string' },
              type: { enum: ['repeat'] },
              count: { type: 'integer', minimum: 1 },
              while: predicateSchema,
              maxIterations: { type: 'integer', minimum: 1, maximum: 1000 },
              steps: { type: 'array', minItems: 1, items: { $ref: '#/definitions/step' } }
            },
            additionalProperties: false
          }
        ]
      }
    }
  }
}

export const buildAutomationActionInputYamlSchema = (command?: AutomationCommand): JsonSchema => ({
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: `rebroid-action-input-${command?.uses ?? 'unknown'}.schema.json`,
  title: command ? `${command.label} input` : 'Action input',
  ...(command?.inputSchema ?? { type: 'object', additionalProperties: true })
})
