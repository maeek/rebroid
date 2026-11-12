import { mapAutomationSteps } from '../tree/automation-step-tree'
import { rewriteAutomationStepReferences } from './automation-step-reference-rewrite'
import type {
  AutomationActionStepForm,
  AutomationConditionStepForm,
  AutomationRepeatStepForm,
  AutomationStepForm,
  AutomationSwitchCaseForm,
  AutomationSwitchStepForm
} from '../../editor/builder-utils'
import type { AutomationConditionExpression, AutomationValueRef } from '@rebroid/automation-core/definition'

const stepClipboardPayloadType = 'rebroid.workflow.step'

interface StepClipboardPayload {
  type: typeof stepClipboardPayloadType
  version: 1
  step: AutomationStepForm
}

export const copyAutomationStepToClipboard = async (step: AutomationStepForm) => {
  await navigator.clipboard.writeText(
    JSON.stringify({
      type: stepClipboardPayloadType,
      version: 1,
      step
    } satisfies StepClipboardPayload)
  )
}

export const readAutomationStepFromClipboard = async (existingSteps: AutomationStepForm[]) => {
  const text = await navigator.clipboard.readText()
  return readAutomationStepFromText(text, existingSteps)
}

export const readAutomationStepFromText = (text: string, existingSteps: AutomationStepForm[]) => {
  const parsed = parseClipboardPayload(text)
  return parsed ? cloneAutomationStep(parsed, existingSteps) : null
}

export const cloneAutomationStep = (step: AutomationStepForm, existingSteps: AutomationStepForm[]) => {
  const usedIds = collectAutomationStepIds(existingSteps)
  const ids = new Map<string, string>()
  const steps = mapAutomationSteps([step], item => {
    const id = item.id.trim()
    const nextId = id ? uniqueStepId(`${id}-copy`, usedIds) : id
    if (id) ids.set(id, nextId)
    const clone = { ...item, id: nextId, clientKey: createClientKey() }
    return clone.kind === 'switch'
      ? { ...clone, cases: clone.cases.map(entry => ({ ...entry, clientKey: createClientKey() })) }
      : clone
  })
  return rewriteAutomationStepReferences(steps, ids)[0]
}

export const isAutomationStepForm = (value: unknown): value is AutomationStepForm => parseStep(value) !== null

const collectAutomationStepIds = (steps: AutomationStepForm[]) => {
  const ids = new Set<string>()
  const visit = (step: AutomationStepForm) => {
    if (step.id.trim()) ids.add(step.id.trim())
    if (step.kind === 'condition') {
      step.thenSteps.forEach(visit)
      step.elseSteps.forEach(visit)
    } else if (step.kind === 'switch') {
      step.cases.forEach(item => item.steps.forEach(visit))
      step.defaultSteps.forEach(visit)
    } else if (step.kind === 'repeat') {
      step.steps.forEach(visit)
    }
  }
  steps.forEach(visit)
  return ids
}

const uniqueStepId = (id: string, usedIds: Set<string>) => {
  if (!id || !usedIds.has(id)) {
    if (id) usedIds.add(id)
    return id
  }

  const base = id.replace(/-copy(?:-\d+)?$/, '')
  let index = 1
  let candidate = `${base}-copy`
  while (usedIds.has(candidate)) {
    index += 1
    candidate = `${base}-copy-${index}`
  }
  usedIds.add(candidate)
  return candidate
}

const parseClipboardPayload = (text: string) => {
  try {
    const parsed = JSON.parse(text) as unknown
    if (!isRecord(parsed) || parsed.type !== stepClipboardPayloadType || parsed.version !== 1) return null
    return parseStep(parsed.step)
  } catch {
    return null
  }
}

const parseStep = (value: unknown): AutomationStepForm | null => {
  if (!isRecord(value) || typeof value.clientKey !== 'string' || typeof value.id !== 'string') return null

  if (value.kind === 'action') return parseActionStep(value)
  if (value.kind === 'condition') return parseConditionStep(value)
  if (value.kind === 'switch') return parseSwitchStep(value)
  if (value.kind === 'repeat') return parseRepeatStep(value)
  return null
}

const parseActionStep = (value: Record<string, unknown>): AutomationActionStepForm | null => {
  if (typeof value.uses !== 'string' || typeof value.withJson !== 'string') return null

  return {
    kind: 'action',
    clientKey: value.clientKey as string,
    id: value.id as string,
    uses: value.uses,
    withJson: value.withJson,
    ...(isRecord(value.uiState) ? { uiState: value.uiState } : {})
  }
}

const parseConditionStep = (value: Record<string, unknown>): AutomationConditionStepForm | null => {
  if (!isConditionExpression(value.condition) || !Array.isArray(value.thenSteps) || !Array.isArray(value.elseSteps)) {
    return null
  }
  const thenSteps = parseStepList(value.thenSteps)
  const elseSteps = parseStepList(value.elseSteps)
  if (!thenSteps || !elseSteps) return null

  return {
    kind: 'condition',
    clientKey: value.clientKey as string,
    id: value.id as string,
    condition: value.condition,
    thenSteps,
    elseSteps
  }
}

const parseSwitchStep = (value: Record<string, unknown>): AutomationSwitchStepForm | null => {
  if (!isValueRef(value.value) || !Array.isArray(value.cases) || !Array.isArray(value.defaultSteps)) return null
  const cases = value.cases.map(parseSwitchCase)
  if (cases.some(item => item === null)) return null
  const defaultSteps = parseStepList(value.defaultSteps)
  if (!defaultSteps) return null

  return {
    kind: 'switch',
    clientKey: value.clientKey as string,
    id: value.id as string,
    value: value.value,
    cases: cases as AutomationSwitchCaseForm[],
    defaultSteps
  }
}

const parseSwitchCase = (value: unknown): AutomationSwitchCaseForm | null => {
  if (!isRecord(value) || typeof value.clientKey !== 'string' || !Array.isArray(value.steps)) return null
  const steps = parseStepList(value.steps)
  if (!steps) return null
  return {
    clientKey: value.clientKey,
    value: value.value,
    steps
  }
}

const parseRepeatStep = (value: Record<string, unknown>): AutomationRepeatStepForm | null => {
  if (
    (value.mode !== 'count' && value.mode !== 'while') ||
    typeof value.count !== 'number' ||
    typeof value.maxIterations !== 'number' ||
    !isConditionExpression(value.while) ||
    !Array.isArray(value.steps)
  ) {
    return null
  }
  const steps = parseStepList(value.steps)
  if (!steps) return null

  return {
    kind: 'repeat',
    clientKey: value.clientKey as string,
    id: value.id as string,
    mode: value.mode,
    count: value.count,
    while: value.while,
    maxIterations: value.maxIterations,
    steps
  }
}

const parseStepList = (values: unknown[]) => {
  const steps = values.map(parseStep)
  return steps.some(step => step === null) ? null : (steps as AutomationStepForm[])
}

const isConditionExpression = (value: unknown): value is AutomationConditionExpression =>
  isRecord(value) &&
  Array.isArray(value.groups) &&
  value.groups.every(
    group =>
      isRecord(group) &&
      Array.isArray(group.conditions) &&
      group.conditions.every(
        condition =>
          isRecord(condition) &&
          isValueRef(condition.value) &&
          typeof condition.operator === 'string' &&
          (condition.compare === undefined || isValueRef(condition.compare))
      )
  )

const isValueRef = (value: unknown): value is AutomationValueRef =>
  isRecord(value) &&
  (value.source === 'literal' ||
    (value.source === 'runContext' && typeof value.key === 'string') ||
    (value.source === 'stepOutput' && typeof value.stepId === 'string' && typeof value.outputKey === 'string'))

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const createClientKey = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
