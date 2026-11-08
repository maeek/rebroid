import { stringify as stringifyYaml } from 'yaml'
import {
  getActionUiStateFromInput,
  getBackendActionInput,
  getDefaultActionInput,
  normalizeActionInput
} from '../actions/action-registry'
import type { Automation, SaveAutomationInput } from '@/shared/contracts/automation'
import type {
  AutomationActionStep,
  AutomationConditionStep,
  AutomationDefinition,
  AutomationDefinitionStep,
  AutomationConditionExpression,
  AutomationValueRef,
  AutomationRepeatStep,
  AutomationSwitchStep,
  AutomationTag
} from '@rebroid/automation-core/definition'

export interface AutomationActionStepForm {
  kind: 'action'
  clientKey: string
  id: string
  uses: string
  withJson: string
  uiState?: Record<string, unknown>
}

export interface AutomationConditionStepForm {
  kind: 'condition'
  clientKey: string
  id: string
  condition: AutomationConditionExpression
  thenSteps: AutomationStepForm[]
  elseSteps: AutomationStepForm[]
}

export interface AutomationSwitchCaseForm {
  clientKey: string
  value: unknown
  steps: AutomationStepForm[]
}

export interface AutomationSwitchStepForm {
  kind: 'switch'
  clientKey: string
  id: string
  value: AutomationValueRef
  cases: AutomationSwitchCaseForm[]
  defaultSteps: AutomationStepForm[]
}

export interface AutomationRepeatStepForm {
  kind: 'repeat'
  clientKey: string
  id: string
  mode: 'count' | 'while'
  count: number
  while: AutomationConditionExpression
  maxIterations: number
  steps: AutomationStepForm[]
}

export type AutomationStepForm =
  | AutomationActionStepForm
  | AutomationConditionStepForm
  | AutomationSwitchStepForm
  | AutomationRepeatStepForm

export interface AutomationFormState {
  id: string | null
  name: string
  description: string
  tags: AutomationTag[]
  steps: AutomationStepForm[]
}

const defaultStepInput = (uses: string): Record<string, unknown> => getDefaultActionInput(uses)

const createClientKey = (seed?: string) => seed ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`

const stepIdBase = (uses: string) =>
  uses
    .split('.')
    .at(-1)
    ?.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
    .replace(/^-/, '') || 'step'

export const defaultStep = (
  uses = 'android.viewerCommand',
  index = 1,
  clientKey?: string
): AutomationActionStepForm => {
  const input = defaultStepInput(uses)

  return {
    kind: 'action',
    clientKey: createClientKey(clientKey),
    id: uses === 'android.viewerCommand' && index === 1 ? 'wake-device' : `${stepIdBase(uses)}-${index}`,
    uses,
    withJson: JSON.stringify(input, null, 2),
    uiState: getActionUiStateFromInput(uses, input)
  }
}

export const defaultForm = (): AutomationFormState => ({
  id: null,
  name: 'New workflow',
  description: '',
  tags: [],
  steps: [defaultStep('android.viewerCommand', 1, 'spec.steps[0]')]
})

export const defaultConditionExpression = (): AutomationConditionExpression => ({
  groups: [
    {
      conditions: [
        {
          value: { source: 'runContext', key: 'targetApplicationId' },
          operator: 'exists'
        }
      ]
    }
  ]
})

export const defaultConditionStep = (index = 1, clientKey?: string): AutomationConditionStepForm => ({
  kind: 'condition',
  clientKey: createClientKey(clientKey),
  id: `condition-${index}`,
  condition: defaultConditionExpression(),
  thenSteps: [defaultStep('android.wait', 1)],
  elseSteps: []
})

export const defaultSwitchStep = (index = 1, clientKey?: string): AutomationSwitchStepForm => ({
  kind: 'switch',
  clientKey: createClientKey(clientKey),
  id: `switch-${index}`,
  value: { source: 'runContext', key: 'targetProfileName' },
  cases: [
    {
      clientKey: createClientKey(),
      value: 'default',
      steps: [defaultStep('debug.log', 1)]
    }
  ],
  defaultSteps: []
})

export const defaultRepeatStep = (index = 1, clientKey?: string): AutomationRepeatStepForm => ({
  kind: 'repeat',
  clientKey: createClientKey(clientKey),
  id: `repeat-${index}`,
  mode: 'count',
  count: 2,
  while: defaultConditionExpression(),
  maxIterations: 2,
  steps: [defaultStep('android.wait', 1)]
})

export const definitionToForm = (definition: AutomationDefinition, id: string | null = null): AutomationFormState => ({
  id,
  name: definition.metadata.name,
  description: definition.metadata.description ?? '',
  tags: definition.metadata.tags ?? [],
  steps: definition.spec.steps.map((step, index) => stepToForm(step, `spec.steps[${index}]`))
})

export const automationToForm = (automation: Automation): AutomationFormState =>
  definitionToForm(automation.definition, automation.id)

const stepToForm = (step: AutomationDefinitionStep, path: string): AutomationStepForm => {
  if ('type' in step && step.type === 'condition') {
    return {
      kind: 'condition',
      clientKey: createClientKey(path),
      id: step.id,
      condition: step.condition,
      thenSteps: step.then.map((item, index) => stepToForm(item, `${path}.then[${index}]`)),
      elseSteps: (step.else ?? []).map((item, index) => stepToForm(item, `${path}.else[${index}]`))
    }
  }

  if ('type' in step && step.type === 'switch') {
    return {
      kind: 'switch',
      clientKey: createClientKey(path),
      id: step.id,
      value: step.value,
      cases: step.cases.map((item, index) => ({
        clientKey: createClientKey(`${path}.cases[${index}]`),
        value: item.value,
        steps: item.steps.map((caseStep, stepIndex) =>
          stepToForm(caseStep, `${path}.cases[${index}].steps[${stepIndex}]`)
        )
      })),
      defaultSteps: (step.default ?? []).map((item, index) => stepToForm(item, `${path}.default[${index}]`))
    }
  }

  if ('type' in step && step.type === 'repeat') {
    return {
      kind: 'repeat',
      clientKey: createClientKey(path),
      id: step.id,
      mode: step.count === undefined ? 'while' : 'count',
      count: step.count ?? 1,
      while: step.while ?? defaultConditionExpression(),
      maxIterations: step.maxIterations,
      steps: step.steps.map((item, index) => stepToForm(item, `${path}.steps[${index}]`))
    }
  }

  const input = normalizeActionInput(step.uses, step.with ?? {})

  return {
    kind: 'action',
    clientKey: createClientKey(path),
    id: step.id,
    uses: step.uses,
    withJson: JSON.stringify(input, null, 2),
    uiState: getActionUiStateFromInput(step.uses, input)
  }
}

const buildDefinition = ({
  name,
  description,
  tags,
  steps
}: Pick<AutomationFormState, 'name' | 'description' | 'tags' | 'steps'>): AutomationDefinition => {
  const normalizedSteps = steps.map((step, index) => stepFormToDefinition(step, index))
  const trimmedDescription = description.trim()

  return {
    apiVersion: 'rebroid.io/automation/v1',
    kind: 'AndroidAutomation',
    metadata: {
      name: name.trim() || 'Automation',
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
      ...(tags.length > 0 ? { tags } : {})
    },
    spec: {
      steps: normalizedSteps
    }
  }
}

const definitionToYaml = (definition: AutomationDefinition) => stringifyYaml(definition, { lineWidth: 0 }).trimEnd()

export const buildYaml = (form: Pick<AutomationFormState, 'name' | 'description' | 'tags' | 'steps'>) =>
  definitionToYaml(buildDefinition(form))

const parseObjectJson = (value: string, fallback: Record<string, unknown> = {}) => {
  const parsed: unknown = JSON.parse(value || '{}')
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : fallback
}

const stepFormToDefinition = (step: AutomationStepForm, index: number): AutomationDefinitionStep => {
  if (step.kind === 'action') {
    return {
      id: step.id.trim() || `${stepIdBase(step.uses)}-${index + 1}`,
      uses: step.uses,
      with: getBackendActionInput(step.uses, parseObjectJson(step.withJson), step.uiState ?? {})
    } satisfies AutomationActionStep
  }
  if (step.kind === 'condition') {
    return {
      id: step.id.trim() || `condition-${index + 1}`,
      type: 'condition',
      condition: step.condition,
      then: step.thenSteps.map(stepFormToDefinition),
      ...(step.elseSteps.length > 0 ? { else: step.elseSteps.map(stepFormToDefinition) } : {})
    } satisfies AutomationConditionStep
  }
  if (step.kind === 'switch') {
    return {
      id: step.id.trim() || `switch-${index + 1}`,
      type: 'switch',
      value: step.value,
      cases: step.cases.map(item => ({
        value: item.value,
        steps: item.steps.map(stepFormToDefinition)
      })),
      ...(step.defaultSteps.length > 0 ? { default: step.defaultSteps.map(stepFormToDefinition) } : {})
    } satisfies AutomationSwitchStep
  }
  return {
    id: step.id.trim() || `repeat-${index + 1}`,
    type: 'repeat',
    ...(step.mode === 'count' ? { count: step.count } : { while: step.while }),
    maxIterations: step.maxIterations,
    steps: step.steps.map(stepFormToDefinition)
  } satisfies AutomationRepeatStep
}

export const formToSaveInput = (form: AutomationFormState): SaveAutomationInput => ({
  yaml: buildYaml(form)
})
