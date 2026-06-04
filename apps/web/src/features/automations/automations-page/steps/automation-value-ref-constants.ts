import type { AutomationPredicateOperator } from '@/server/orchestrator/automations/types'

export interface AutomationStepReferenceOption {
  id: string
  label: string
  uses?: string
}

export type LiteralKind = 'string' | 'number' | 'boolean' | 'null'

export const contextPaths = [
  'runId',
  'trigger',
  'targetApplicationId',
  'targetProfileMode',
  'targetProfileName',
  'app.id',
  'app.packageName',
  'app.status',
  'app.profileName',
  'app.profileMode'
]

export const commonOutputPaths = ['summary']

export const outputPathsByUses: Record<string, string[]> = {
  'android.getClipboard': ['text', 'supported'],
  'android.screenshot': ['mimeType', 'capturedAt', 'dataUrl'],
  'android.tapText': ['x', 'y'],
  'android.adbShell': ['stdout', 'stderr', 'exitCode'],
  'android.pullFile': ['contentBase64', 'mimeType', 'size'],
  'android.fileExists': ['exists'],
  'android.listFiles': ['files'],
  'artifact.saveScreenshot': ['mimeType', 'capturedAt', 'dataUrl'],
  'flow.stop': ['stop']
}

export const operatorOptions: { value: AutomationPredicateOperator; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'notEquals', label: 'Does not equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'exists', label: 'Exists' },
  { value: 'greaterThan', label: 'Greater than' },
  { value: 'greaterThanOrEqual', label: 'Greater than or equal' },
  { value: 'lessThan', label: 'Less than' },
  { value: 'lessThanOrEqual', label: 'Less than or equal' },
  { value: 'matches', label: 'Matches regex' }
]
