import { parseDocument } from 'yaml'
import {
  allowsAdditionalProperties,
  enumValues,
  indentation,
  inputSchemaForCurrentProperty,
  isRecord,
  propertiesOf,
  requiredPropertiesOf,
  schemaForCurrentProperty,
  workflowContext,
  type JsonSchema
} from './automation-yaml-language-utils'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'
import type * as Monaco from 'monaco-editor'

export const validateAutomationYamlModel = ({
  monaco,
  model,
  commands,
  schema
}: {
  monaco: typeof Monaco
  model: Monaco.editor.ITextModel
  commands: AutomationCommand[]
  schema: JsonSchema
}): Monaco.editor.IMarkerData[] => {
  const markers: Monaco.editor.IMarkerData[] = []
  const parsed = parseDocument(model.getValue(), { prettyErrors: false })
  for (const error of parsed.errors) markers.push(yamlParseMarker(monaco, model, error))

  for (let lineNumber = 1; lineNumber <= model.getLineCount(); lineNumber += 1) {
    const line = model.getLineContent(lineNumber)
    const usesMatch = line.match(/^(\s*(?:-\s*)?uses:\s*)([^\s#]*)/)
    if (usesMatch) {
      const uses = usesMatch[2] ?? ''
      const validUses = commands.map(command => command.uses)
      if (!uses || !validUses.includes(uses)) {
        markers.push(enumMarker(monaco, lineNumber, usesMatch[1]?.length ?? 0, uses, validUses))
      }
      continue
    }

    const withMatch = line.match(/^(\s*)with:\s*(?:#.*)?$/)
    if (withMatch) {
      markers.push(
        ...missingRequiredPropertyMarkers({
          monaco,
          model,
          commands,
          lineNumber,
          withIndent: withMatch[1]?.length ?? 0,
          lineLength: line.length
        })
      )
      continue
    }

    const propertyMatch = line.match(/^(\s*)([\w-]+)(:\s*)([^\s#]*)/)
    if (!propertyMatch) continue

    const propertyName = propertyMatch[2] ?? ''
    const rawValue = propertyMatch[4] ?? ''
    const position = new monaco.Position(lineNumber, line.length + 1)
    const inputSchema = inputSchemaForCurrentProperty(model, position, commands)

    if (inputSchema && !allowsAdditionalProperties(inputSchema) && !(propertyName in propertiesOf(inputSchema))) {
      markers.push(unknownPropertyMarker(monaco, lineNumber, (propertyMatch[1] ?? '').length, propertyName))
      continue
    }

    const propertySchema = schemaForCurrentProperty(model, position, propertyName, commands, schema)
    const values = enumValues(propertySchema)
    const value = rawValue.replace(/^['"]|['"]$/g, '')
    if (values.length > 0 && !values.includes(value)) {
      markers.push(
        enumMarker(
          monaco,
          lineNumber,
          (propertyMatch[1] ?? '').length + propertyName.length + (propertyMatch[3] ?? '').length,
          rawValue,
          values
        )
      )
    }
  }

  return markers
}

const missingRequiredPropertyMarkers = ({
  monaco,
  model,
  commands,
  lineNumber,
  withIndent,
  lineLength
}: {
  monaco: typeof Monaco
  model: Monaco.editor.ITextModel
  commands: AutomationCommand[]
  lineNumber: number
  withIndent: number
  lineLength: number
}) => {
  const contextLineNumber = Math.min(lineNumber + 1, model.getLineCount())
  const context = workflowContext(model, new monaco.Position(contextLineNumber, withIndent + 3))
  const inputSchema = commands.find(command => command.uses === context?.uses)?.inputSchema
  const requiredProperties = requiredPropertiesOf(inputSchema)
  if (requiredProperties.length === 0) return []

  const presentProperties = new Set<string>()
  for (let childLineNumber = lineNumber + 1; childLineNumber <= model.getLineCount(); childLineNumber += 1) {
    const childLine = model.getLineContent(childLineNumber)
    if (!childLine.trim()) continue
    if (indentation(childLine) <= withIndent) break
    const propertyMatch = childLine.match(/^\s*([\w-]+):/)
    if (propertyMatch?.[1]) presentProperties.add(propertyMatch[1])
  }

  return requiredProperties
    .filter(property => !presentProperties.has(property))
    .map(property => ({
      severity: monaco.MarkerSeverity.Error,
      message: `Missing required property: ${property}`,
      startLineNumber: lineNumber,
      endLineNumber: lineNumber,
      startColumn: Math.max(lineLength - 'with'.length, 0) + 1,
      endColumn: lineLength + 1
    }))
}

const enumMarker = (
  monaco: typeof Monaco,
  lineNumber: number,
  startOffset: number,
  value: string,
  values: string[]
): Monaco.editor.IMarkerData => ({
  severity: monaco.MarkerSeverity.Error,
  message: `Expected one of: ${values.join(', ')}`,
  startLineNumber: lineNumber,
  endLineNumber: lineNumber,
  startColumn: startOffset + 1,
  endColumn: startOffset + Math.max(value.length, 1) + 1
})

const unknownPropertyMarker = (
  monaco: typeof Monaco,
  lineNumber: number,
  startOffset: number,
  propertyName: string
): Monaco.editor.IMarkerData => ({
  severity: monaco.MarkerSeverity.Error,
  message: `Unknown property: ${propertyName}`,
  startLineNumber: lineNumber,
  endLineNumber: lineNumber,
  startColumn: startOffset + 1,
  endColumn: startOffset + propertyName.length + 1
})

const yamlParseMarker = (
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
  error: unknown
): Monaco.editor.IMarkerData => {
  const linePositions = isRecord(error) && Array.isArray(error.linePos) ? (error.linePos as unknown[]) : []
  const linePosition = linePositions[0] ?? null
  const lineNumber =
    isRecord(linePosition) && typeof linePosition.line === 'number'
      ? Math.min(Math.max(linePosition.line, 1), model.getLineCount())
      : 1
  const column = isRecord(linePosition) && typeof linePosition.col === 'number' ? Math.max(linePosition.col, 1) : 1
  const message = isRecord(error) && typeof error.message === 'string' ? error.message : 'Invalid YAML syntax.'

  return {
    severity: monaco.MarkerSeverity.Error,
    message,
    startLineNumber: lineNumber,
    endLineNumber: lineNumber,
    startColumn: column,
    endColumn: Math.max(column + 1, model.getLineMaxColumn(lineNumber))
  }
}
