import { enumValues, isRecord, propertiesOf, yamlScalar } from './automation-yaml-language-utils'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'

export const commandStepSnippet = ({
  command,
  listIndent,
  firstPlaceholderIndex = 1
}: {
  command: AutomationCommand
  listIndent: number
  firstPlaceholderIndex?: number
}) => {
  const childIndentSize = listIndent + 2
  const childIndent = ' '.repeat(childIndentSize)

  return [
    `- id: \${${firstPlaceholderIndex}:step-id}`,
    `${childIndent}uses: ${command.uses}`,
    ...commandWithBlockSnippet({
      command,
      propertyIndent: childIndentSize,
      firstPlaceholderIndex: firstPlaceholderIndex + 1
    })
  ].join('\n')
}

export const commandWithBlockSnippet = ({
  command,
  propertyIndent,
  firstPlaceholderIndex = 1
}: {
  command: AutomationCommand
  propertyIndent: number
  firstPlaceholderIndex?: number
}) => {
  const indent = ' '.repeat(propertyIndent)
  const fieldIndent = ' '.repeat(propertyIndent + 2)
  const fields = commandInputSnippetFields(command, firstPlaceholderIndex)

  if (fields.length === 0) return [`${indent}with: {}`]

  return [`${indent}with:`, ...fields.map(field => `${fieldIndent}${field.key}: ${field.value}`)]
}

const commandInputSnippetFields = (command: AutomationCommand, firstPlaceholderIndex: number) => {
  const properties = propertiesOf(command.inputSchema)

  return command.editor.yamlSnippetFields.map((fieldName, index) => ({
    key: yamlKey(fieldName),
    value: `\${${firstPlaceholderIndex + index}:${snippetPlaceholderValue({
      schema: properties[fieldName],
      defaultValue: command.editor.inputDefaults[fieldName],
      fieldName
    })}}`
  }))
}

const snippetPlaceholderValue = ({
  schema,
  defaultValue,
  fieldName
}: {
  schema: unknown
  defaultValue: unknown
  fieldName: string
}) => {
  if (defaultValue !== undefined) return snippetEscape(yamlValue(defaultValue))
  if (!isRecord(schema)) return snippetEscape(fieldName)

  const [firstEnumValue] = enumValues(schema)
  if (firstEnumValue) return snippetEscape(yamlScalar(firstEnumValue))

  const type = schemaType(schema)
  if (type === 'integer' || type === 'number') return '0'
  if (type === 'boolean') return 'false'
  if (type === 'array') return '[]'
  if (type === 'object') return '{}'
  return snippetEscape(fieldName)
}

const schemaType = (schema: Record<string, unknown>): string | null => {
  if (typeof schema.type === 'string') return schema.type
  if (Array.isArray(schema.type)) {
    const types: unknown[] = schema.type
    return types.find((item): item is string => item !== 'null' && typeof item === 'string') ?? null
  }
  return null
}

const yamlKey = (key: string) => (/^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key))

const yamlValue = (value: unknown) => {
  if (typeof value === 'string') return yamlScalar(value)
  return JSON.stringify(value)
}

const snippetEscape = (value: string) => value.replace(/[\\$}]/g, match => `\\${match}`)
