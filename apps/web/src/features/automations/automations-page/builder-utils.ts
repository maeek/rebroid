import type { Automation, AutomationDefinitionStep } from '@/server/orchestrator/automations/types'

export interface AutomationStepForm {
  id: string
  uses: string
  withJson: string
}

export interface AutomationFormState {
  id: string | null
  name: string
  description: string
  labelsJson: string
  steps: AutomationStepForm[]
  yaml: string
  scheduleEnabled: boolean
  cronExpression: string
  targetApplicationId: string
}

export const defaultStep = (uses = 'android.viewerCommand'): AutomationStepForm => ({
  id: 'wake-device',
  uses,
  withJson: JSON.stringify({ command: 'wake' }, null, 2)
})

export const defaultForm = (): AutomationFormState => ({
  id: null,
  name: 'New automation',
  description: '',
  labelsJson: '{}',
  steps: [defaultStep()],
  yaml: buildYaml({
    name: 'New automation',
    description: '',
    labelsJson: '{}',
    steps: [defaultStep()]
  }),
  scheduleEnabled: false,
  cronExpression: '0 9 * * *',
  targetApplicationId: ''
})

export const automationToForm = (automation: Automation): AutomationFormState => ({
  id: automation.id,
  name: automation.name,
  description: automation.description ?? '',
  labelsJson: JSON.stringify(automation.definition.metadata.labels ?? {}, null, 2),
  steps: automation.definition.spec.steps.map(stepToForm),
  yaml: automation.yaml,
  scheduleEnabled: automation.scheduleEnabled,
  cronExpression: automation.cronExpression ?? '0 9 * * *',
  targetApplicationId: automation.targetApplicationId ?? ''
})

const stepToForm = (step: AutomationDefinitionStep): AutomationStepForm => ({
  id: step.id,
  uses: step.uses,
  withJson: JSON.stringify(step.with ?? {}, null, 2)
})

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
  const normalizedSteps = steps.map(step => ({
    id: step.id.trim(),
    uses: step.uses,
    with: JSON.parse(step.withJson || '{}') as Record<string, unknown>
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

export const formToSaveInput = (form: AutomationFormState) => ({
  yaml: form.yaml,
  scheduleEnabled: form.scheduleEnabled,
  cronExpression: form.scheduleEnabled ? form.cronExpression : null,
  targetApplicationId: form.targetApplicationId || null
})
