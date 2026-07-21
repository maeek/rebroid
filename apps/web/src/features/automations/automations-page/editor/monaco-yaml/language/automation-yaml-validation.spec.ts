import { describe, expect, it } from 'vitest'
import { validateAutomationYamlModel } from './automation-yaml-validation'
import type { AutomationCommand } from '@/shared/contracts/automation'
import type * as Monaco from 'monaco-editor'

const monaco = {
  MarkerSeverity: { Error: 8 },
  Position: class {
    constructor(
      public readonly lineNumber: number,
      public readonly column: number
    ) {}
  }
} as unknown as typeof Monaco

class TextModelStub {
  private readonly lines: string[]

  constructor(private readonly value: string) {
    this.lines = value.split('\n')
  }

  getValue() {
    return this.value
  }

  getLineContent(lineNumber: number) {
    return this.lines[lineNumber - 1] ?? ''
  }

  getLineCount() {
    return this.lines.length
  }

  getLineMaxColumn(lineNumber: number) {
    return this.getLineContent(lineNumber).length + 1
  }

  getOffsetAt(position: Monaco.Position) {
    let offset = 0
    for (let lineNumber = 1; lineNumber < position.lineNumber; lineNumber += 1) {
      offset += this.getLineContent(lineNumber).length + 1
    }
    return offset + position.column - 1
  }
}

const commands: AutomationCommand[] = [
  {
    uses: 'android.swipeNormalized',
    label: 'Swipe normalized',
    description: 'Swipes between normalized coordinates.',
    requiredPermissions: ['automations:run'],
    inputSchema: {
      type: 'object',
      properties: {
        start: {
          type: 'object',
          properties: {
            x: { type: 'number', minimum: 0, maximum: 1 },
            y: { type: 'number', minimum: 0, maximum: 1 }
          },
          required: ['x', 'y'],
          additionalProperties: false
        },
        end: {
          type: 'object',
          properties: {
            x: { type: 'number', minimum: 0, maximum: 1 },
            y: { type: 'number', minimum: 0, maximum: 1 }
          },
          required: ['x', 'y'],
          additionalProperties: false
        },
        durationMs: { type: 'integer', default: 300 }
      },
      required: ['start', 'end'],
      additionalProperties: false
    },
    outputs: [],
    editor: {
      inputDefaults: { durationMs: 300 },
      inputFieldOrder: ['start', 'end', 'durationMs'],
      yamlSnippetFields: ['start', 'end', 'durationMs']
    }
  },
  {
    uses: 'vision.locate',
    label: 'Locate',
    description: 'Finds visible UI elements.',
    requiredPermissions: ['automations:run'],
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        region: {
          type: 'object',
          properties: {
            left: { type: 'number' },
            top: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' }
          },
          required: ['left', 'top', 'width', 'height'],
          additionalProperties: false
        }
      },
      required: ['query'],
      additionalProperties: false
    },
    outputs: [],
    editor: {
      inputDefaults: {},
      inputFieldOrder: ['query', 'region'],
      yamlSnippetFields: ['query']
    }
  },
  {
    uses: 'ai.run',
    label: 'AI run',
    description: 'Runs an AI harness.',
    requiredPermissions: ['automations:run-ai'],
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        conversation: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['user', 'assistant'] },
              content: { type: 'string' }
            },
            required: ['role', 'content'],
            additionalProperties: false
          }
        }
      },
      required: ['prompt'],
      additionalProperties: false
    },
    outputs: [],
    editor: {
      inputDefaults: {},
      inputFieldOrder: ['prompt', 'conversation'],
      yamlSnippetFields: ['prompt']
    }
  }
]

describe('automation YAML validation markers', () => {
  it('accepts nested android.swipeNormalized point fields', () => {
    const messages = validate(
      workflowYaml('android.swipeNormalized', [
        '        start:',
        '          x: 0.5',
        '          y: 0.8',
        '        end:',
        '          x: 0.5',
        '          y: 0.2',
        '        durationMs: 300'
      ])
    ).map(marker => marker.message)

    expect(messages).not.toContain('Unknown property: x')
    expect(messages).not.toContain('Unknown property: y')
  })

  it('reports real unknown nested command input fields', () => {
    const messages = validate(
      workflowYaml('vision.locate', [
        '        query: Login',
        '        region:',
        '          left: 0',
        '          top: 0',
        '          bottom: 1'
      ])
    ).map(marker => marker.message)

    expect(messages).toContain('Unknown property: bottom')
  })

  it('validates enum values inside array item objects', () => {
    const messages = validate(
      workflowYaml('ai.run', [
        '        prompt: Inspect',
        '        conversation:',
        '          - role: system',
        '            content: Hello'
      ])
    ).map(marker => marker.message)

    expect(messages).toContain('Expected one of: user, assistant')
  })
})

const workflowYaml = (uses: string, withLines: string[]) => `apiVersion: rebroid.io/automation/v1
kind: AndroidAutomation
metadata:
  name: Test
spec:
  steps:
    - uses: ${uses}
      with:
${withLines.join('\n')}`

const validate = (value: string) =>
  validateAutomationYamlModel({
    monaco,
    model: new TextModelStub(value) as unknown as Monaco.editor.ITextModel,
    commands,
    schema: {}
  })
