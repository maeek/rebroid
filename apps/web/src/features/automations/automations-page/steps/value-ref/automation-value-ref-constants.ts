import type { AutomationCommandOutput, AutomationValueType } from '@rebroid/automation-core/definition'

export interface AutomationStepReferenceOption {
  id: string
  label: string
  uses?: string
  outputs: AutomationCommandOutput[]
}

export interface AutomationReferenceOption {
  id: string
  label: string
  group: 'Run context' | 'Previous steps'
  type: AutomationValueType
  value: {
    source: 'runContext' | 'stepOutput'
    key?: string
    stepId?: string
    outputKey?: string
  }
}

export type LiteralKind = 'string' | 'number' | 'boolean' | 'null'
