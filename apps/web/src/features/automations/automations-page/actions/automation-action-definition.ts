import type { ReactNode } from 'react'
import type { AutomationCommand } from '@/server/orchestrator/automations/types'

export type AutomationActionCategory =
  | 'Device'
  | 'Touch'
  | 'Text'
  | 'Files'
  | 'Network'
  | 'Assertions'
  | 'Flow'
  | 'Debug'
  | 'AI'

export type AutomationActionIconKey =
  | 'alert'
  | 'check'
  | 'click'
  | 'clock'
  | 'debug'
  | 'device'
  | 'file'
  | 'file-check'
  | 'file-export'
  | 'file-import'
  | 'files'
  | 'keyboard'
  | 'message'
  | 'network'
  | 'route'
  | 'rotate'
  | 'screenshot'
  | 'shield'
  | 'sparkles'
  | 'swipe'
  | 'terminal'
  | 'text'
  | 'trash'
  | 'x'

export interface AutomationActionEditorProps {
  command?: AutomationCommand
  commands: AutomationCommand[]
  input: Record<string, unknown>
  uiState: Record<string, unknown>
  patchInput: (patch: Record<string, unknown>) => void
  replaceInput: (input: Record<string, unknown>) => void
  patchUiState: (patch: Record<string, unknown>) => void
}

export interface AutomationActionDefinition {
  uses: string
  category: AutomationActionCategory
  iconKey: AutomationActionIconKey
  label?: string
  description?: string
  defaultInput: () => Record<string, unknown>
  normalizeInput?: (input: Record<string, unknown>) => Record<string, unknown>
  fromBackendInput?: (input: Record<string, unknown>) => Record<string, unknown>
  toBackendInput?: (input: Record<string, unknown>, uiState: Record<string, unknown>) => Record<string, unknown>
  summary: (input: Record<string, unknown>) => string
  renderEditor: (props: AutomationActionEditorProps) => ReactNode
}
