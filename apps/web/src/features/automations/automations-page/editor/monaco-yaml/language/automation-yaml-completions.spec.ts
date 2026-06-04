import { describe, expect, it } from '@jest/globals'
import { validateAutomationYamlModel } from './automation-yaml-validation'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'
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

  getLineCount() {
    return this.lines.length
  }

  getLineContent(lineNumber: number) {
    return this.lines[lineNumber - 1] ?? ''
  }

  getLineMaxColumn(lineNumber: number) {
    return this.getLineContent(lineNumber).length + 1
  }
}

const commands: AutomationCommand[] = [
  {
    uses: 'android.viewerCommand',
    label: 'Viewer command',
    description: 'Sends a supported viewer control command.',
    requiredPermissions: ['automations:run'],
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', enum: ['back', 'home', 'wake'] }
      },
      required: ['command'],
      additionalProperties: false
    }
  }
]

describe('automation YAML Monaco markers', () => {
  it('marks invalid enum values and unknown command input properties', () => {
    const model = new TextModelStub(`apiVersion: rebroid.io/automation/v1
kind: AndroidAutomation
metadata:
  name: Test
spec:
  steps:
    - id: wake-device
      uses: android.viewerCommand
      with:
        command: yee
        telete: uuuu`)

    const markers = validateAutomationYamlModel({
      monaco,
      model: model as unknown as Monaco.editor.ITextModel,
      commands,
      schema: {}
    })

    expect(markers.map(marker => marker.message)).toEqual(
      expect.arrayContaining(['Expected one of: back, home, wake', 'Unknown property: telete'])
    )
  })
})
