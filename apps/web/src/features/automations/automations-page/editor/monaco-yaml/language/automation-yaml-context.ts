import { yamlPathAt } from './automation-yaml-ast-utils'
import { indentation, nearestUsesFromPath, offsetAt, workflowContext } from './automation-yaml-language-utils'
import type * as Monaco from 'monaco-editor'
import type { ParsedNode } from 'yaml'

export type AutomationYamlCompletionContext =
  | {
      kind: 'step-list-item'
      listIndent: number
      replaceStartColumn: number
    }
  | {
      kind: 'tag-list-item'
      listIndent: number
      replaceStartColumn: number
    }
  | {
      kind: 'uses-value'
      query: string
      stepIndent: number
      propertyIndent: number
      replaceStartColumn: number
      hasWithBlock: boolean
    }
  | {
      kind: 'with-property'
      uses: string
      indent: number
    }
  | {
      kind: 'schema'
    }

export const automationYamlCompletionContext = (
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
  root: ParsedNode | null
): AutomationYamlCompletionContext => {
  const line = model.getLineContent(position.lineNumber)
  const linePrefix = line.slice(0, position.column - 1)
  const offset = offsetAt(model, position)

  const usesContext = usesValueContext(model, position, linePrefix)
  if (usesContext) return usesContext

  const listItemContext = stepListItemContext(model, position, linePrefix, root, offset)
  if (listItemContext) return listItemContext

  const tagItemContext = tagListItemContext(model, position, linePrefix, root, offset)
  if (tagItemContext) return tagItemContext

  const withContext = withPropertyContext(model, position, root, offset)
  if (withContext) return withContext

  return { kind: 'schema' }
}

const tagListItemContext = (
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
  linePrefix: string,
  root: ParsedNode | null,
  offset: number
): Extract<AutomationYamlCompletionContext, { kind: 'tag-list-item' }> | null => {
  const match = linePrefix.match(/^(\s*)-\s*$/)
  if (!match) return null

  const listIndent = match[1]?.length ?? 0
  if (!isTagArrayPosition(model, position.lineNumber, listIndent, root, offset)) return null

  return {
    kind: 'tag-list-item',
    listIndent,
    replaceStartColumn: listIndent + 1
  }
}

const usesValueContext = (
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
  linePrefix: string
): Extract<AutomationYamlCompletionContext, { kind: 'uses-value' }> | null => {
  const match = linePrefix.match(/^(\s*)(?:-\s*)?uses:\s*([\w.-]*)$/)
  if (!match) return null

  const query = match[2] ?? ''
  const propertyIndent = propertyIndentForUsesLine(linePrefix)
  const stepIndent = stepIndentForUsesLine(model, position.lineNumber, linePrefix)

  return {
    kind: 'uses-value',
    query,
    stepIndent,
    propertyIndent,
    replaceStartColumn: position.column - query.length,
    hasWithBlock: hasSiblingWithBlock(model, position.lineNumber, stepIndent, propertyIndent)
  }
}

const stepListItemContext = (
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
  linePrefix: string,
  root: ParsedNode | null,
  offset: number
): Extract<AutomationYamlCompletionContext, { kind: 'step-list-item' }> | null => {
  const match = linePrefix.match(/^(\s*)-\s*$/)
  if (!match) return null

  const listIndent = match[1]?.length ?? 0
  if (!isAutomationStepArrayPosition(model, position.lineNumber, listIndent, root, offset)) return null

  return {
    kind: 'step-list-item',
    listIndent,
    replaceStartColumn: listIndent + 1
  }
}

const withPropertyContext = (
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
  root: ParsedNode | null,
  offset: number
): Extract<AutomationYamlCompletionContext, { kind: 'with-property' }> | null => {
  const line = model.getLineContent(position.lineNumber)
  const linePrefix = line.slice(0, position.column - 1)
  if (!/^(\s*)([\w-]*)$/.test(linePrefix)) return null

  const path = yamlPathAt(root, offset)
  const withIndex = path.lastIndexOf('with')
  if (withIndex === -1) return fallbackWithPropertyContext(model, position)
  const uses = nearestUsesFromPath(root, path.slice(0, withIndex))
  if (!uses) return fallbackWithPropertyContext(model, position)

  return { kind: 'with-property', uses, indent: indentation(linePrefix) }
}

const isAutomationStepArrayPosition = (
  model: Monaco.editor.ITextModel,
  lineNumber: number,
  listIndent: number,
  root: ParsedNode | null,
  offset: number
) => {
  const path = yamlPathAt(root, offset)
  if (isStepArrayPath(path)) return true
  return fallbackIsStepArrayItem(model, lineNumber, listIndent)
}

const isTagArrayPosition = (
  model: Monaco.editor.ITextModel,
  lineNumber: number,
  listIndent: number,
  root: ParsedNode | null,
  offset: number
) => {
  const path = yamlPathAt(root, offset)
  if (path.includes('metadata') && path.includes('tags')) return true
  return fallbackIsTagArrayItem(model, lineNumber, listIndent)
}

const isStepArrayPath = (path: Array<string | number>) => {
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const item = path[index]
    if (item === 'steps' || item === 'then' || item === 'else' || item === 'default') return true
  }
  return false
}

const propertyIndentForUsesLine = (linePrefix: string) => {
  const inlineItemMatch = linePrefix.match(/^(\s*)-\s*uses:/)
  if (inlineItemMatch) return (inlineItemMatch[1]?.length ?? 0) + 2
  return indentation(linePrefix)
}

const stepIndentForUsesLine = (model: Monaco.editor.ITextModel, lineNumber: number, linePrefix: string) =>
  linePrefix.match(/^(\s*)-\s*uses:/)?.[1]?.length ?? nearestStepIndent(model, lineNumber)

const nearestStepIndent = (model: Monaco.editor.ITextModel, lineNumber: number) => {
  for (let previousLineNumber = lineNumber; previousLineNumber >= 1; previousLineNumber -= 1) {
    const line = model.getLineContent(previousLineNumber)
    const match = line.match(/^(\s*)-\s+/)
    if (match) return match[1]?.length ?? 0
  }

  return -1
}

const hasSiblingWithBlock = (
  model: Monaco.editor.ITextModel,
  lineNumber: number,
  stepIndent: number,
  propertyIndent: number
) => {
  for (
    let candidateLineNumber = lineNumber + 1;
    candidateLineNumber <= model.getLineCount();
    candidateLineNumber += 1
  ) {
    const candidate = model.getLineContent(candidateLineNumber)
    if (!candidate.trim()) continue
    const candidateIndent = indentation(candidate)
    if (candidateIndent <= stepIndent) return false
    if (candidateIndent === propertyIndent && /^\s*with:\s*/.test(candidate)) return true
  }

  return false
}

const fallbackWithPropertyContext = (
  model: Monaco.editor.ITextModel,
  position: Monaco.Position
): Extract<AutomationYamlCompletionContext, { kind: 'with-property' }> | null => {
  const context = workflowContext(model, position, model.getLineContent(position.lineNumber) === '')
  return context?.uses ? { kind: 'with-property', uses: context.uses, indent: context.indent } : null
}

const fallbackIsStepArrayItem = (model: Monaco.editor.ITextModel, lineNumber: number, listIndent: number) => {
  for (let previousLineNumber = lineNumber - 1; previousLineNumber >= 1; previousLineNumber -= 1) {
    const line = model.getLineContent(previousLineNumber)
    if (!line.trim()) continue
    const previousIndent = indentation(line)
    if (previousIndent > listIndent) continue
    if (previousIndent === listIndent && /^\s*-\s+/.test(line)) continue
    if (previousIndent < listIndent) return /^\s*(?:steps|then|else|default):\s*(?:#.*)?$/.test(line)
    return false
  }

  return false
}

const fallbackIsTagArrayItem = (model: Monaco.editor.ITextModel, lineNumber: number, listIndent: number) => {
  for (let previousLineNumber = lineNumber - 1; previousLineNumber >= 1; previousLineNumber -= 1) {
    const line = model.getLineContent(previousLineNumber)
    if (!line.trim()) continue
    const previousIndent = indentation(line)
    if (previousIndent > listIndent) continue
    if (previousIndent === listIndent && /^\s*-\s+/.test(line)) continue
    if (previousIndent < listIndent) return /^\s*tags:\s*(?:#.*)?$/.test(line)
    return false
  }

  return false
}
