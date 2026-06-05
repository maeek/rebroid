import type {
  AutomationActionStepForm,
  AutomationConditionStepForm,
  AutomationRepeatStepForm,
  AutomationStepForm,
  AutomationSwitchCaseForm,
  AutomationSwitchStepForm
} from '../../editor/builder-utils'
import type { AutomationPredicate, AutomationValueRef } from '@/server/orchestrator/automations/types'

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

export const readAutomationStepFromClipboard = async () => {
  const text = await navigator.clipboard.readText()
  const parsed = parseClipboardPayload(text)
  return parsed ? cloneAutomationStep(parsed, '-copy') : null
}

export const cloneAutomationStep = (step: AutomationStepForm, idSuffix = ''): AutomationStepForm => {
  const nextKey = createClientKey()
  const id = idSuffix && step.id ? `${step.id}${idSuffix}` : step.id

  if (step.kind === 'action') {
    return { ...step, id, clientKey: nextKey }
  }
  if (step.kind === 'condition') {
    return {
      ...step,
      id,
      clientKey: nextKey,
      thenSteps: step.thenSteps.map(item => cloneAutomationStep(item, idSuffix)),
      elseSteps: step.elseSteps.map(item => cloneAutomationStep(item, idSuffix))
    }
  }
  if (step.kind === 'switch') {
    return {
      ...step,
      id,
      clientKey: nextKey,
      cases: step.cases.map(item => ({
        ...item,
        clientKey: createClientKey(),
        steps: item.steps.map(caseStep => cloneAutomationStep(caseStep, idSuffix))
      })),
      defaultSteps: step.defaultSteps.map(item => cloneAutomationStep(item, idSuffix))
    }
  }
  return {
    ...step,
    id,
    clientKey: nextKey,
    steps: step.steps.map(item => cloneAutomationStep(item, idSuffix))
  }
}

export const isAutomationStepForm = (value: unknown): value is AutomationStepForm => parseStep(value) !== null

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
  if (!isPredicate(value.condition) || !Array.isArray(value.thenSteps) || !Array.isArray(value.elseSteps)) return null
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
    !isPredicate(value.while) ||
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

const isPredicate = (value: unknown): value is AutomationPredicate =>
  isRecord(value) &&
  isValueRef(value.left) &&
  typeof value.operator === 'string' &&
  (value.operator === 'exists' || value.right === undefined || isValueRef(value.right))

const isValueRef = (value: unknown): value is AutomationValueRef =>
  isRecord(value) &&
  (value.source === 'literal' ||
    (value.source === 'context' && typeof value.path === 'string') ||
    (value.source === 'step' && typeof value.stepId === 'string' && typeof value.path === 'string'))

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const createClientKey = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
