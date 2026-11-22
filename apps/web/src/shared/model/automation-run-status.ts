import type { AutomationRunEvent, AutomationRunStatus } from '@/shared/contracts/automation'

export const isActiveRunStatus = (status: AutomationRunStatus) => status === 'running' || status === 'queued'
export const isTerminalRunStatus = (status: AutomationRunStatus) =>
  status === 'success' || status === 'failed' || status === 'canceled'

export function terminalEventStatus(event: AutomationRunEvent): 'success' | 'failed' | 'canceled' | null {
  if (event.type === 'run.completed') return 'success'
  if (event.type === 'run.failed') return 'failed'
  if (event.type === 'run.canceled') return 'canceled'
  return null
}

export const runStatusFromEvent = (event: AutomationRunEvent) =>
  event.type === 'run.started' ? 'running' : terminalEventStatus(event)
