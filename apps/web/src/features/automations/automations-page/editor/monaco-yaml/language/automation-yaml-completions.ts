import { automationYamlCompletionContext, type AutomationYamlCompletionContext } from './automation-yaml-context'
import { commandStepSnippet, commandWithBlockSnippet } from './automation-yaml-snippets'
import {
  enumValues,
  propertiesOf,
  schemaForCurrentProperty,
  type JsonSchema,
  yamlScalar
} from './automation-yaml-language-utils'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'
import type * as Monaco from 'monaco-editor'

export const createAutomationYamlCompletionProvider = ({
  monaco,
  commands,
  schema
}: {
  monaco: typeof Monaco
  commands: AutomationCommand[]
  schema: JsonSchema
}): Monaco.languages.CompletionItemProvider => ({
  triggerCharacters: [':', ' ', '.', '-'],
  provideCompletionItems(model, position) {
    const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1)
    const context = automationYamlCompletionContext(model, position)
    const range = completionRange(monaco, position, linePrefix)
    const suggestions = [
      ...usesSuggestions(monaco, context, position, commands),
      ...stepSkeletonSuggestions(monaco, context, position, commands),
      ...propertyValueSuggestions(monaco, model, position, linePrefix, range, commands, schema),
      ...propertyNameSuggestions(monaco, context, linePrefix, range, commands, schema)
    ]

    return { suggestions }
  }
})

const usesSuggestions = (
  monaco: typeof Monaco,
  context: AutomationYamlCompletionContext,
  position: Monaco.Position,
  commands: AutomationCommand[]
) => {
  if (context.kind !== 'uses-value') return []
  const range = new monaco.Range(position.lineNumber, context.replaceStartColumn, position.lineNumber, position.column)

  return commands
    .filter(command => command.uses.startsWith(context.query))
    .map(command => {
      const withBlock = context.hasWithBlock
        ? null
        : commandWithBlockSnippet({
            command,
            propertyIndent: context.propertyIndent,
            firstPlaceholderIndex: 1
          })

      return {
        label: command.uses,
        kind: monaco.languages.CompletionItemKind.EnumMember,
        detail: command.label,
        documentation: command.description,
        filterText: command.uses,
        insertText: withBlock ? [command.uses, ...withBlock].join('\n') : command.uses,
        insertTextRules: withBlock ? snippetInsertTextRules(monaco) : undefined,
        range
      }
    })
}

const stepSkeletonSuggestions = (
  monaco: typeof Monaco,
  context: AutomationYamlCompletionContext,
  position: Monaco.Position,
  commands: AutomationCommand[]
) => {
  if (context.kind !== 'step-list-item') return []

  const listIndent = context.listIndent
  const childIndent = ' '.repeat(listIndent + 2)
  const nestedItemIndent = ' '.repeat(listIndent + 4)
  const range = new monaco.Range(position.lineNumber, context.replaceStartColumn, position.lineNumber, position.column)
  const commandSuggestions = commands.map((command, index) => ({
    label: command.uses,
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: `Action step: ${command.label}`,
    documentation: command.description,
    filterText: `${command.uses} ${command.label}`,
    insertText: commandStepSnippet({ command, listIndent }),
    insertTextRules: snippetInsertTextRules(monaco),
    sortText: `0-action-${String(index).padStart(4, '0')}-${command.uses}`,
    range
  }))

  return [
    ...commandSuggestions,
    {
      label: 'Condition step',
      kind: monaco.languages.CompletionItemKind.Snippet,
      detail: 'Rebroid automation condition step',
      insertText: [
        '- id: ${1:condition-step}',
        `${childIndent}type: condition`,
        `${childIndent}condition:`,
        `${childIndent}  left:`,
        `${childIndent}    source: context`,
        `${childIndent}    path: \${2:path}`,
        `${childIndent}  operator: exists`,
        `${childIndent}then:`,
        `${nestedItemIndent}- $0`
      ].join('\n'),
      insertTextRules: snippetInsertTextRules(monaco),
      sortText: '1-condition-step',
      range
    },
    {
      label: 'Repeat step',
      kind: monaco.languages.CompletionItemKind.Snippet,
      detail: 'Rebroid automation repeat step',
      insertText: [
        '- id: ${1:repeat-step}',
        `${childIndent}type: repeat`,
        `${childIndent}count: \${2:1}`,
        `${childIndent}maxIterations: \${3:10}`,
        `${childIndent}steps:`,
        `${nestedItemIndent}- $0`
      ].join('\n'),
      insertTextRules: snippetInsertTextRules(monaco),
      sortText: '2-repeat-step',
      range
    },
    {
      label: 'Switch step',
      kind: monaco.languages.CompletionItemKind.Snippet,
      detail: 'Rebroid automation switch step',
      insertText: [
        '- id: ${1:switch-step}',
        `${childIndent}type: switch`,
        `${childIndent}value:`,
        `${childIndent}  source: context`,
        `${childIndent}  path: \${2:path}`,
        `${childIndent}cases:`,
        `${nestedItemIndent}- value: \${3:value}`,
        `${nestedItemIndent}  steps:`,
        `${nestedItemIndent}    - $0`
      ].join('\n'),
      insertTextRules: snippetInsertTextRules(monaco),
      sortText: '3-switch-step',
      range
    }
  ]
}

const propertyValueSuggestions = (
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
  linePrefix: string,
  range: Monaco.IRange,
  commands: AutomationCommand[],
  schema: JsonSchema
) => {
  const match = linePrefix.match(/^\s*([\w-]+):\s*([\w.-]*)$/)
  if (!match) return []

  const propertyName = match[1] ?? ''
  if (propertyName === 'uses') return []

  const query = match[2] ?? ''
  const propertySchema = schemaForCurrentProperty(model, position, propertyName, commands, schema)
  const values = enumValues(propertySchema)

  return values
    .filter(value => value.startsWith(query))
    .map(value => ({
      label: value,
      kind: monaco.languages.CompletionItemKind.EnumMember,
      insertText: yamlScalar(value),
      range
    }))
}

const propertyNameSuggestions = (
  monaco: typeof Monaco,
  context: AutomationYamlCompletionContext,
  linePrefix: string,
  range: Monaco.IRange,
  commands: AutomationCommand[],
  schema: JsonSchema
) => {
  const match = linePrefix.match(/^(\s*)([\w-]*)$/)
  if (!match || context.kind === 'step-list-item') return []

  const query = match[2] ?? ''
  const activeSchema =
    context.kind === 'with-property'
      ? commands.find(command => command.uses === context.uses)?.inputSchema
      : schema
  const propertyNames =
    context.kind === 'with-property'
      ? commands.find(command => command.uses === context.uses)?.editor.inputFieldOrder ?? []
      : Object.keys(propertiesOf(activeSchema))
  const indentPrefix = context.kind === 'with-property' && linePrefix.trim() === '' ? ' '.repeat(context.indent) : ''

  return propertyNames
    .filter(propertyName => propertyName.startsWith(query))
    .map(propertyName => ({
      label: propertyName,
      kind: monaco.languages.CompletionItemKind.Property,
      insertText: `${indentPrefix}${propertyName}: `,
      sortText: `5-${propertyName}`,
      range
    }))
}

const completionRange = (monaco: typeof Monaco, position: Monaco.Position, linePrefix: string) => {
  const match = linePrefix.match(/[\w.-]*$/)
  const tokenLength = match?.[0]?.length ?? 0
  return new monaco.Range(position.lineNumber, position.column - tokenLength, position.lineNumber, position.column)
}

const snippetInsertTextRules = (monaco: typeof Monaco) =>
  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet |
  monaco.languages.CompletionItemInsertTextRule.KeepWhitespace
