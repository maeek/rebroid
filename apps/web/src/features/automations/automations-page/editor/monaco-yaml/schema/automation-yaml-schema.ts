import type { AutomationCommand } from '@/server/orchestrator/automations/types'

type JsonSchema = Record<string, unknown>

const valueRefSchema: JsonSchema = {
  oneOf: [
    {
      type: 'object',
      required: ['source'],
      properties: {
        source: { enum: ['literal'] },
        value: {}
      },
      additionalProperties: false
    },
    {
      type: 'object',
      required: ['source', 'key'],
      properties: {
        source: { enum: ['runContext'] },
        key: {
          enum: [
            'runId',
            'trigger',
            'targetApplicationId',
            'targetProfileMode',
            'targetProfileName',
            'app.id',
            'app.packageName',
            'app.status',
            'app.profileName',
            'app.profileMode'
          ]
        }
      },
      additionalProperties: false
    },
    {
      type: 'object',
      required: ['source', 'stepId', 'outputKey'],
      properties: {
        source: { enum: ['stepOutput'] },
        stepId: { type: 'string' },
        outputKey: { type: 'string' }
      },
      additionalProperties: false
    }
  ]
}

const conditionRuleSchema: JsonSchema = {
  type: 'object',
  required: ['value', 'operator'],
  properties: {
    value: valueRefSchema,
    operator: {
      enum: [
        'equals',
        'notEquals',
        'contains',
        'doesNotContain',
        'exists',
        'doesNotExist',
        'isEmpty',
        'isNotEmpty',
        'isTrue',
        'isFalse',
        'greaterThan',
        'greaterThanOrEqual',
        'lessThan',
        'lessThanOrEqual',
        'matches',
        'lengthEquals',
        'lengthGreaterThan',
        'lengthLessThan'
      ]
    },
    compare: valueRefSchema
  },
  additionalProperties: false
}

const conditionExpressionSchema: JsonSchema = {
  type: 'object',
  required: ['groups'],
  properties: {
    groups: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['conditions'],
        properties: {
          conditions: {
            type: 'array',
            minItems: 1,
            items: conditionRuleSchema
          }
        },
        additionalProperties: false
      }
    }
  },
  additionalProperties: false
}

export const buildAutomationYamlSchema = (commands: AutomationCommand[]): JsonSchema => {
  const actionSteps = commands.map(command => ({
    type: 'object',
    required: ['id', 'uses', 'with'],
    properties: {
      id: { type: 'string', description: 'Unique step identifier.' },
      uses: { enum: [command.uses], description: command.description },
      with: {
        description: `${command.label} input.`,
        default: command.editor.inputDefaults,
        ...command.inputSchema
      }
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
            items: {
              type: 'object',
              required: ['name', 'color'],
              properties: {
                name: { type: 'string', minLength: 1, maxLength: 48 },
                color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }
              },
              additionalProperties: false
            },
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
              condition: conditionExpressionSchema,
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
              while: conditionExpressionSchema,
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
