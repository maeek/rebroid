import {
  enumValues,
  propertiesOf,
  schemaForCurrentProperty,
  workflowContext,
  yamlScalar,
  type JsonSchema
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
    const range = completionRange(monaco, model, position)
    const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1)
    const suggestions = [
      ...usesSuggestions(monaco, linePrefix, range, commands),
      ...propertyValueSuggestions(monaco, model, position, linePrefix, range, commands, schema),
      ...propertyNameSuggestions(monaco, model, position, linePrefix, range, commands, schema)
    ]

    return { suggestions }
  }
})

const usesSuggestions = (
  monaco: typeof Monaco,
  linePrefix: string,
  range: Monaco.IRange,
  commands: AutomationCommand[]
) => {
  const match = linePrefix.match(/^\s*uses:\s*([\w.-]*)$/)
  if (!match) return []
  const query = match[1] ?? ''

  return commands
    .filter(command => command.uses.startsWith(query))
    .map(command => ({
      label: command.uses,
      kind: monaco.languages.CompletionItemKind.EnumMember,
      detail: command.label,
      documentation: command.description,
      insertText: command.uses,
      range
    }))
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

  const propertyName = match[1]
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
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
  linePrefix: string,
  range: Monaco.IRange,
  commands: AutomationCommand[],
  schema: JsonSchema
) => {
  const match = linePrefix.match(/^(\s*)([\w-]*)$/)
  if (!match) return []

  const context = workflowContext(model, position)
  const activeSchema = context?.uses ? commands.find(command => command.uses === context.uses)?.inputSchema : schema
  const propertyNames = Object.keys(propertiesOf(activeSchema))
  const query = match[2] ?? ''
  const indentPrefix = context && linePrefix.trim() === '' ? ' '.repeat(context.indent) : ''

  return propertyNames
    .filter(propertyName => propertyName.startsWith(query))
    .map(propertyName => ({
      label: propertyName,
      kind: monaco.languages.CompletionItemKind.Property,
      insertText: `${indentPrefix}${propertyName}: `,
      sortText: `0-${propertyName}`,
      range
    }))
}

const completionRange = (monaco: typeof Monaco, model: Monaco.editor.ITextModel, position: Monaco.Position) => {
  const word = model.getWordUntilPosition(position)
  return new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
}
