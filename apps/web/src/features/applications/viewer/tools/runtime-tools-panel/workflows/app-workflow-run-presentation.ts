import type { AutomationRunTrigger } from '@/shared/contracts/automation'

export const workflowRunTriggerLabels: Record<AutomationRunTrigger, string> = {
  manual: 'Manual',
  schedule: 'Scheduled',
  webhook: 'Webhook',
  event: 'Event'
}

export const workflowRunDuration = (startedAt: string | null, completedAt: string | null) => {
  if (!startedAt || !completedAt) return '—'
  const milliseconds = Date.parse(completedAt) - Date.parse(startedAt)
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '—'
  if (milliseconds < 1000) return '<1 s'
  const seconds = Math.floor(milliseconds / 1000)
  if (seconds < 60) return `${seconds} s`
  return `${Math.floor(seconds / 60)} m ${seconds % 60} s`
}

export const workflowRunIsActive = (status: string) => status === 'queued' || status === 'running'
