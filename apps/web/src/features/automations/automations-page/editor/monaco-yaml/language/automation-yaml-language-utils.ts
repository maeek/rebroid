import { isMap, isScalar, parseDocument, type ParsedNode } from 'yaml'
import { yamlNodeAtPath, yamlPathAt } from './automation-yaml-ast-utils'
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
  const schemaContext = schemaContextForCurrentProperty(model, position, propertyName, commands)
  if (schemaContext?.propertySchema) return schemaContext.propertySchema

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

export const schemaContextForCurrentProperty = (
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
  propertyName: string,
  commands: AutomationCommand[]
): { parentSchema: JsonSchema | null; propertySchema: JsonSchema | null } | null => {
  const document = parseDocument(model.getValue(), { prettyErrors: false })
  const path = ensureCurrentPropertyPath(
    yamlPathAt(document.contents, Math.max(0, offsetAt(model, position) - 1)),
    propertyName
  )
  const withIndex = path.lastIndexOf('with')
  if (withIndex === -1) return null

  const uses =
    nearestUsesFromPath(document.contents, path.slice(0, withIndex)) ?? workflowContext(model, position)?.uses
  const inputSchema = commands.find(command => command.uses === uses)?.inputSchema
  if (!inputSchema) return null

  const inputPath = path.slice(withIndex + 1)
  if (inputPath.length === 0) return null

  return {
    parentSchema: schemaAtPath(inputSchema, inputPath.slice(0, -1)),
    propertySchema: schemaAtPath(inputSchema, inputPath)
  }
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
    const usesMatch = line.match(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/)
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

const ensureCurrentPropertyPath = (path: Array<string | number>, propertyName: string) => {
  if (path.at(-1) === propertyName) return path
  const withIndex = path.lastIndexOf('with')
  return withIndex === -1 ? path : [...path, propertyName]
}

const schemaAtPath = (schema: unknown, path: Array<string | number>): JsonSchema | null => {
  let current: unknown = schema

  for (const pathItem of path) {
    if (!isRecord(current)) return null
    if (typeof pathItem === 'number') {
      current = current.items
      continue
    }
    current = propertiesOf(current)[pathItem]
  }

  return isRecord(current) ? current : null
}

const nearestUsesFromPath = (root: ParsedNode | null, stepPath: Array<string | number>) => {
  const node = yamlNodeAtPath(root, stepPath)
  if (!node || !isMap(node)) return null

  const usesPair = node.items.find(pair => isScalar(pair.key) && pair.key.value === 'uses')
  return usesPair?.value && isScalar(usesPair.value) ? String(usesPair.value.value) : null
}

const offsetAt = (model: Monaco.editor.ITextModel, position: Monaco.Position) => {
  if ('getOffsetAt' in model && typeof model.getOffsetAt === 'function') return model.getOffsetAt(position)

  let offset = 0
  for (let lineNumber = 1; lineNumber < position.lineNumber; lineNumber += 1) {
    offset += model.getLineContent(lineNumber).length + 1
  }

  return offset + position.column - 1
}
