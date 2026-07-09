import { normalizeBuildContextPath } from './dockerfile-context-path'
import type { DockerfileContextInstruction, DockerfileContextReference } from './dockerfile-context-types'

type LogicalDockerfileLine = {
  lineNumber: number
  text: string
}

const localInstructions = new Set<DockerfileContextInstruction>(['ADD', 'COPY'])
const remoteUrlPattern = /^[a-z][a-z0-9+.-]*:\/\//i
const globPattern = /[*?[]/

export const parseDockerfileContextReferences = (dockerfile: string): DockerfileContextReference[] => {
  const references: DockerfileContextReference[] = []
  for (const line of logicalDockerfileLines(dockerfile)) {
    const match = line.text.match(/^\s*(ADD|COPY)\s+(.+)$/i)
    if (!match) {
      continue
    }

    const instruction = match[1].toUpperCase() as DockerfileContextInstruction
    if (!localInstructions.has(instruction)) {
      continue
    }

    references.push(...parseInstructionSources(instruction, match[2], line.lineNumber))
  }

  return references
}

const logicalDockerfileLines = (dockerfile: string) => {
  const lines: LogicalDockerfileLine[] = []
  let current = ''
  let currentLineNumber = 1

  dockerfile.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1
    const trimmedRight = line.replace(/\s+$/, '')
    if (!current) {
      currentLineNumber = lineNumber
    }

    if (trimmedRight.endsWith('\\') && !trimmedRight.endsWith('\\\\')) {
      current += `${trimmedRight.slice(0, -1)} `
      return
    }

    const logicalLine = `${current}${line}`.trim()
    current = ''
    if (!logicalLine || logicalLine.startsWith('#')) {
      return
    }
    lines.push({ lineNumber: currentLineNumber, text: logicalLine })
  })

  if (current.trim()) {
    lines.push({ lineNumber: currentLineNumber, text: current.trim() })
  }

  return lines
}

const parseInstructionSources = (
  instruction: DockerfileContextInstruction,
  argumentsText: string,
  lineNumber: number
) => {
  const jsonStart = argumentsText.indexOf('[')
  if (jsonStart >= 0) {
    const optionTokens = tokenizeShellWords(argumentsText.slice(0, jsonStart))
    const jsonText = argumentsText.slice(jsonStart)
    if (hasStageCopyOption(optionTokens)) {
      return [ignoredReference(instruction, lineNumber, jsonText, 'Stage copies do not use the build context.')]
    }
    return parseJsonInstructionSources(instruction, jsonText, lineNumber)
  }

  const tokens = tokenizeShellWords(argumentsText)
  const { options, rest } = splitDockerfileOptions(tokens)
  if (hasStageCopyOption(options)) {
    return [ignoredReference(instruction, lineNumber, rest.join(' '), 'Stage copies do not use the build context.')]
  }
  if (rest.length < 2) {
    return []
  }

  return rest.slice(0, -1).map((source, index) => referenceFromSource(instruction, lineNumber, source, index))
}

const parseJsonInstructionSources = (
  instruction: DockerfileContextInstruction,
  jsonText: string,
  lineNumber: number
) => {
  try {
    const values = JSON.parse(jsonText) as unknown
    if (!Array.isArray(values) || values.length < 2 || values.some(value => typeof value !== 'string')) {
      return [
        unsupportedReference(instruction, lineNumber, jsonText, 'JSON form must include sources and destination.')
      ]
    }

    return (values as string[])
      .slice(0, -1)
      .map((source, index) => referenceFromSource(instruction, lineNumber, source, index))
  } catch {
    return [unsupportedReference(instruction, lineNumber, jsonText, 'Could not parse Dockerfile JSON form.')]
  }
}

const referenceFromSource = (
  instruction: DockerfileContextInstruction,
  lineNumber: number,
  source: string,
  index: number
): DockerfileContextReference => {
  const id = `${lineNumber}:${instruction}:${index}:${source}`
  const trimmedSource = source.trim()

  if (trimmedSource.startsWith('<<')) {
    return unsupportedReference(
      instruction,
      lineNumber,
      source,
      'Here-doc sources are not imported from local context.'
    )
  }
  if (remoteUrlPattern.test(trimmedSource)) {
    return ignoredReference(instruction, lineNumber, source, 'Remote sources are fetched by Docker.')
  }
  if (globPattern.test(trimmedSource)) {
    return unsupportedReference(instruction, lineNumber, source, 'Wildcard Dockerfile sources are not supported yet.')
  }
  if (trimmedSource.includes('$')) {
    return unsupportedReference(instruction, lineNumber, source, 'Variable Dockerfile sources are not supported yet.')
  }
  if (trimmedSource.startsWith('/')) {
    return ignoredReference(instruction, lineNumber, source, 'Absolute sources are outside the build context.')
  }

  const contextPath = normalizeBuildContextPath(trimmedSource)
  if (contextPath === null) {
    return ignoredReference(instruction, lineNumber, source, 'Sources cannot traverse outside the build context.')
  }
  if (!contextPath) {
    return unsupportedReference(instruction, lineNumber, source, 'Whole-root context imports are not supported yet.')
  }

  return {
    contextPath,
    directoryHint: /\/$/.test(trimmedSource),
    id,
    instruction,
    lineNumber,
    reason: null,
    source,
    state: 'local'
  }
}

const unsupportedReference = (
  instruction: DockerfileContextInstruction,
  lineNumber: number,
  source: string,
  reason: string
): DockerfileContextReference => ({
  contextPath: null,
  directoryHint: false,
  id: `${lineNumber}:${instruction}:unsupported:${source}`,
  instruction,
  lineNumber,
  reason,
  source,
  state: 'unsupported'
})

const ignoredReference = (
  instruction: DockerfileContextInstruction,
  lineNumber: number,
  source: string,
  reason: string
): DockerfileContextReference => ({
  contextPath: null,
  directoryHint: false,
  id: `${lineNumber}:${instruction}:ignored:${source}`,
  instruction,
  lineNumber,
  reason,
  source,
  state: 'ignored'
})

const tokenizeShellWords = (value: string) => {
  const words: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let escaping = false

  for (const character of value) {
    if (escaping) {
      current += character
      escaping = false
      continue
    }
    if (character === '\\') {
      escaping = true
      continue
    }
    if (quote) {
      if (character === quote) {
        quote = null
      } else {
        current += character
      }
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (/\s/.test(character)) {
      if (current) {
        words.push(current)
        current = ''
      }
      continue
    }
    current += character
  }

  if (current) {
    words.push(current)
  }

  return words
}

const splitDockerfileOptions = (tokens: string[]) => {
  const options: string[] = []
  let index = 0
  while (index < tokens.length && tokens[index].startsWith('--')) {
    const option = tokens[index]
    options.push(option)
    index += 1
    if (option === '--from' && index < tokens.length) {
      options.push(tokens[index])
      index += 1
    }
  }

  return { options, rest: tokens.slice(index) }
}

const hasStageCopyOption = (options: string[]) =>
  options.some(
    (option, index) => option === '--from' || option.startsWith('--from=') || options[index - 1] === '--from'
  )
