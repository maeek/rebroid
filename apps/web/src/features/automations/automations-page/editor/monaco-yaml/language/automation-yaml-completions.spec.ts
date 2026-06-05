import { describe, expect, it } from '@jest/globals'
import { createAutomationYamlCompletionProvider } from './automation-yaml-completions'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'
import type * as Monaco from 'monaco-editor'

const monaco = {
  languages: {
    CompletionItemInsertTextRule: { KeepWhitespace: 1, InsertAsSnippet: 4 },
    CompletionItemKind: { EnumMember: 12, Property: 9, Snippet: 27 }
  },
  Range: class {
    constructor(
      public readonly startLineNumber: number,
      public readonly startColumn: number,
      public readonly endLineNumber: number,
      public readonly endColumn: number
    ) {}
  }
} as unknown as typeof Monaco

class TextModelStub {
  private readonly value: string
  private readonly lines: string[]

  constructor(value: string) {
    this.value = value
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
    },
    outputs: [{ key: 'summary', label: 'Summary', type: 'string', description: 'Step summary.' }],
    editor: {
      inputDefaults: {},
      inputFieldOrder: ['command'],
      yamlSnippetFields: ['command']
    }
  },
  {
    uses: 'network.resetPolicy',
    label: 'Reset policy',
    description: 'Resets network policy.',
    requiredPermissions: ['automations:run'],
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    outputs: [{ key: 'summary', label: 'Summary', type: 'string', description: 'Step summary.' }],
    editor: {
      inputDefaults: {},
      inputFieldOrder: [],
      yamlSnippetFields: []
    }
  },
  {
    uses: 'android.swipe',
    label: 'Swipe',
    description: 'Swipes between two coordinates.',
    requiredPermissions: ['automations:run'],
    inputSchema: {
      type: 'object',
      properties: {
        x1: { type: 'number' },
        y1: { type: 'number' },
        x2: { type: 'number' },
        y2: { type: 'number' },
        durationMs: { type: 'integer', default: 300 }
      },
      required: ['x1', 'y1', 'x2', 'y2'],
      additionalProperties: false
    },
    outputs: [{ key: 'summary', label: 'Summary', type: 'string', description: 'Step summary.' }],
    editor: {
      inputDefaults: { durationMs: 300 },
      inputFieldOrder: ['x1', 'y1', 'x2', 'y2', 'durationMs'],
      yamlSnippetFields: ['x1', 'y1', 'x2', 'y2', 'durationMs']
    }
  }
]

describe('automation YAML completions', () => {
  it('suggests commands for a mapping uses property', () => {
    const suggestions = completeAtEnd('uses: android.', 1)

    expect(suggestions.map(suggestion => suggestion.label)).toEqual(['android.viewerCommand', 'android.swipe'])
  })

  it('suggests commands for an inline list item uses property', () => {
    const suggestions = completeAtEnd('- uses: android.', 1)

    expect(suggestions.map(suggestion => suggestion.label)).toEqual(['android.viewerCommand', 'android.swipe'])
  })

  it('adds required command inputs when completing a missing with block', () => {
    const suggestions = completeAtEnd(
      `spec:
  steps:
    - id: step-id
      uses: android.`,
      4
    )
    const swipeSuggestion = suggestions.find(suggestion => suggestion.label === 'android.swipe')

    expect(String(swipeSuggestion?.insertText)).toContain(`android.swipe
      with:
        x1: \${1:0}
        y1: \${2:0}
        x2: \${3:0}
        y2: \${4:0}
        durationMs: \${5:300}`)
  })

  it('does not add a duplicate with block when one already exists', () => {
    const suggestions = completeAtEnd(
      `spec:
  steps:
    - id: step-id
      uses: android.
      with:
        x1: 0`,
      4
    )
    const swipeSuggestion = suggestions.find(suggestion => suggestion.label === 'android.swipe')

    expect(swipeSuggestion?.insertText).toBe('android.swipe')
  })

  it('suggests command input enum values from the fallback schema path', () => {
    const suggestions = completeAtEnd(
      `spec:
  steps:
    - id: wake-device
      uses: android.viewerCommand
      with:
        command: h`,
      6
    )

    expect(suggestions.map(suggestion => suggestion.label)).toEqual(['home'])
  })

  it('suggests step skeletons after a bare item in a step array', () => {
    const suggestions = completeAtEnd(
      `spec:
  steps:
    - `,
      3
    )

    expect(suggestions.map(suggestion => suggestion.label)).toEqual([
      'android.viewerCommand',
      'network.resetPolicy',
      'android.swipe',
      'Condition step',
      'Repeat step',
      'Switch step'
    ])
    expect(String(suggestions[0]?.insertText)).toContain('uses: android.viewerCommand')
    expect(suggestions[0]?.range).toMatchObject({ startColumn: 5, endColumn: 7 })
  })

  it('suggests step skeletons on nested blank items in condition branches', () => {
    const suggestions = completeAtEnd(
      `spec:
  steps:
    - id: branch
      type: condition
      condition:
        groups:
          - conditions:
              - value:
                  source: runContext
                  key: targetApplicationId
                operator: exists
      then:
        - `,
      13
    )

    expect(suggestions.map(suggestion => suggestion.label)).toEqual([
      'android.viewerCommand',
      'network.resetPolicy',
      'android.swipe',
      'Condition step',
      'Repeat step',
      'Switch step'
    ])
    expect(suggestions[0]?.range).toMatchObject({ startColumn: 9, endColumn: 11 })
  })

  it('normalizes inline uses completion into a valid multiline action step body', () => {
    const suggestions = completeAtEnd(
      `spec:
  steps:
    - uses: android.`,
      3
    )
    const viewerCommandSuggestion = suggestions.find(suggestion => suggestion.label === 'android.viewerCommand')

    expect(String(viewerCommandSuggestion?.insertText)).toContain(`android.viewerCommand
      with:
        command: \${1:back}`)
  })

  it('inserts command-specific step snippets with required inputs and correct indentation', () => {
    const suggestions = completeAtEnd(
      `spec:
  steps:
    - `,
      3
    )
    const swipeSuggestion = suggestions.find(suggestion => suggestion.label === 'android.swipe')

    expect(String(swipeSuggestion?.insertText)).toContain(`- id: \${1:step-id}
      uses: android.swipe
      with:
        x1: \${2:0}
        y1: \${3:0}
        x2: \${4:0}
        y2: \${5:0}
        durationMs: \${6:300}`)
    expect(swipeSuggestion?.insertTextRules).toBe(5)
    expect(swipeSuggestion?.range).toMatchObject({ startColumn: 5, endColumn: 7 })
  })

  it('replaces the bare item marker for control-flow snippets', () => {
    const suggestions = completeAtEnd(
      `spec:
  steps:
    - `,
      3
    )
    const conditionSuggestion = suggestions.find(suggestion => suggestion.label === 'Condition step')

    expect(String(conditionSuggestion?.insertText)).toContain(`- id: \${1:condition-step}
      type: condition`)
    expect(conditionSuggestion?.insertTextRules).toBe(5)
    expect(conditionSuggestion?.range).toMatchObject({ startColumn: 5, endColumn: 7 })
  })

  it('suggests tag skeletons inside metadata tag arrays', () => {
    const suggestions = completeAtEnd(
      `metadata:
  tags:
    - `,
      3
    )

    const tagSuggestion = suggestions.find(suggestion => suggestion.label === 'Tag')

    expect(String(tagSuggestion?.insertText)).toContain(`- name: \${1:tag}
      color: '\${2:#64748b}'`)
    expect(tagSuggestion?.insertTextRules).toBe(5)
  })
})

const complete = (value: string, lineNumber: number, column: number) => {
  const provider = createAutomationYamlCompletionProvider({ monaco, commands, schema: {} })
  const result = provider.provideCompletionItems(
    new TextModelStub(value) as unknown as Monaco.editor.ITextModel,
    { lineNumber, column } as Monaco.Position,
    {} as Monaco.languages.CompletionContext,
    {} as Monaco.CancellationToken
  )

  if (!result || 'then' in result) throw new Error('Expected synchronous completion results.')
  return result.suggestions
}

const completeAtEnd = (value: string, lineNumber: number) => {
  const line = value.split('\n')[lineNumber - 1] ?? ''
  return complete(value, lineNumber, line.length + 1)
}
