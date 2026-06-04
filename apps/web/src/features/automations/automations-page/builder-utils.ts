import {
  getActionUiStateFromInput,
  getBackendActionInput,
  getDefaultActionInput,
  normalizeActionInput
} from './actions/action-registry'
import type {
  Automation,
  AutomationDefinition,
  AutomationDefinitionStep,
  SaveAutomationInput
} from '@/server/orchestrator/automations/types'

export interface AutomationStepForm {
  clientKey: string
  id: string
  uses: string
  withJson: string
  uiState?: Record<string, unknown>
}

export interface AutomationFormState {
  id: string | null
  name: string
  description: string
  labelsJson: string
  steps: AutomationStepForm[]
}

export const defaultStepInput = (uses: string): Record<string, unknown> => getDefaultActionInput(uses)

const createClientKey = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`

const stepIdBase = (uses: string) =>
  uses
    .split('.')
    .at(-1)
    ?.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
    .replace(/^-/, '') || 'step'

export const defaultStep = (uses = 'android.viewerCommand', index = 1): AutomationStepForm => {
  const input = defaultStepInput(uses)

  return {
    clientKey: createClientKey(),
    id: uses === 'android.viewerCommand' && index === 1 ? 'wake-device' : `${stepIdBase(uses)}-${index}`,
    uses,
    withJson: JSON.stringify(input, null, 2),
    uiState: getActionUiStateFromInput(uses, input)
  }
}

export const defaultForm = (): AutomationFormState => ({
  id: null,
  name: 'New automation',
  description: '',
  labelsJson: '{}',
  steps: [defaultStep()]
})

export const definitionToForm = (definition: AutomationDefinition, id: string | null = null): AutomationFormState => ({
  id,
  name: definition.metadata.name,
  description: definition.metadata.description ?? '',
  labelsJson: JSON.stringify(definition.metadata.labels ?? {}, null, 2),
  steps: definition.spec.steps.map(stepToForm)
})

export const automationToForm = (automation: Automation): AutomationFormState =>
  definitionToForm(automation.definition, automation.id)

const stepToForm = (step: AutomationDefinitionStep): AutomationStepForm => {
  const input = normalizeActionInput(step.uses, step.with ?? {})

  return {
    clientKey: createClientKey(),
    id: step.id,
    uses: step.uses,
    withJson: JSON.stringify(input, null, 2),
    uiState: getActionUiStateFromInput(step.uses, input)
  }
}

const indent = (value: string, spaces: number) =>
  value
    .split('\n')
    .map(line => `${' '.repeat(spaces)}${line}`)
    .join('\n')

const scalar = (value: string) => JSON.stringify(value)

const yamlValue = (value: unknown, level: number): string => {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'string') return scalar(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return `\n${value.map(item => `${' '.repeat(level)}- ${yamlValue(item, level + 2).trimStart()}`).join('\n')}`
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return '{}'
    return `\n${entries.map(([key, item]) => `${' '.repeat(level)}${key}: ${yamlValue(item, level + 2).trimStart()}`).join('\n')}`
  }
  return scalar(Object.prototype.toString.call(value))
}

export const buildYaml = ({
  name,
  description,
  labelsJson,
  steps
}: Pick<AutomationFormState, 'name' | 'description' | 'labelsJson' | 'steps'>) => {
  const labels = JSON.parse(labelsJson || '{}') as Record<string, string>
  const normalizedSteps = steps.map((step, index) => ({
    id: step.id.trim() || `${stepIdBase(step.uses)}-${index + 1}`,
    uses: step.uses,
    with: getBackendActionInput(
      step.uses,
      JSON.parse(step.withJson || '{}') as Record<string, unknown>,
      step.uiState ?? {}
    )
  }))

  const metadataLines = [`  name: ${scalar(name.trim() || 'Automation')}`]
  if (description.trim()) metadataLines.push(`  description: ${scalar(description.trim())}`)
  if (Object.keys(labels).length > 0) {
    metadataLines.push('  labels:')
    metadataLines.push(indent(yamlValue(labels, 4).trimStart(), 4))
  }

  const stepLines = normalizedSteps.flatMap(step => [
    `    - id: ${scalar(step.id)}`,
    `      uses: ${scalar(step.uses)}`,
    `      with:${yamlValue(step.with, 8)}`
  ])

  return [
    'apiVersion: rebroid.io/automation/v1',
    'kind: AndroidAutomation',
    'metadata:',
    ...metadataLines,
    'spec:',
    '  steps:',
    ...stepLines
  ].join('\n')
}

export const formToSaveInput = (form: AutomationFormState): SaveAutomationInput => ({
  yaml: buildYaml(form)
})
