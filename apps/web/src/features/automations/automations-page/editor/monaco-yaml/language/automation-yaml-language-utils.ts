import type { AutomationCommand } from '@/server/orchestrator/automations/types'
import type * as Monaco from 'monaco-editor'

export type JsonSchema = Record<string, unknown>

export const propertiesOf = (schema: unknown): Record<string, JsonSchema> => {
  if (!isRecord(schema) || !isRecord(schema.properties)) return {}
  return schema.properties as Record<string, JsonSchema>
}

export const allowsAdditionalProperties = (schema: unknown) => {
  if (!isRecord(schema)) return true
  return schema.additionalProperties !== false
}

export const enumValues = (schema: unknown): string[] => {
  if (!isRecord(schema)) return []
  if (Array.isArray(schema.enum)) return schema.enum.map(value => String(value))
  if (Array.isArray(schema.anyOf)) return schema.anyOf.flatMap(enumValues)
  if (Array.isArray(schema.oneOf)) return schema.oneOf.flatMap(enumValues)
  return []
}

export const requiredPropertiesOf = (schema: unknown): string[] => {
  if (!isRecord(schema) || !Array.isArray(schema.required)) return []
  return schema.required.filter((item): item is string => typeof item === 'string')
}

export const schemaForCurrentProperty = (
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
  propertyName: string,
  commands: AutomationCommand[],
  schema: JsonSchema
) => {
  const context = workflowContext(model, position)
  if (context?.uses) {
    return propertiesOf(commands.find(command => command.uses === context.uses)?.inputSchema)[propertyName]
  }

  return propertiesOf(schema)[propertyName]
}

export const inputSchemaForCurrentProperty = (
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
  commands: AutomationCommand[]
) => {
  const context = workflowContext(model, position)
  if (!context?.uses) return null

  return commands.find(command => command.uses === context.uses)?.inputSchema ?? null
}

export const workflowContext = (model: Monaco.editor.ITextModel, position: Monaco.Position) => {
  let currentIndent = indentation(model.getLineContent(position.lineNumber))
  if (model.getLineContent(position.lineNumber).trim() === '') {
    currentIndent = inferredBlankLineIndent(model, position.lineNumber) ?? currentIndent
  }
  let uses: string | null = null
  let withIndent: number | null = null

  for (let lineNumber = position.lineNumber - 1; lineNumber >= 1; lineNumber -= 1) {
    const line = model.getLineContent(lineNumber)
    const indent = indentation(line)
    const usesMatch = line.match(/^\s*uses:\s*([^\s#]+)/)
    if (!uses && usesMatch) uses = usesMatch[1] ?? null
    if (withIndent === null && /^\s*with:\s*(?:#.*)?$/.test(line)) withIndent = indent
    if (/^\s*-\s+/.test(line) && indent < currentIndent) break
  }

  return withIndent !== null && currentIndent > withIndent ? { uses, indent: currentIndent } : null
}

export const yamlScalar = (value: string) => (/^[A-Za-z0-9_.-]+$/.test(value) ? value : JSON.stringify(value))

export const indentation = (line: string) => line.match(/^\s*/)?.[0].length ?? 0

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const inferredBlankLineIndent = (model: Monaco.editor.ITextModel, lineNumber: number) => {
  for (let previousLineNumber = lineNumber - 1; previousLineNumber >= 1; previousLineNumber -= 1) {
    const line = model.getLineContent(previousLineNumber)
    if (!line.trim()) continue
    return /:\s*(?:#.*)?$/.test(line) ? indentation(line) + 2 : indentation(line)
  }

  return null
}
