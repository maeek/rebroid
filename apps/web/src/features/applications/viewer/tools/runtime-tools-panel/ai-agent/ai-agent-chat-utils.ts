import { AUTOMATION_AI_RUN_MAX_TIMEOUT_MS } from '@rebroid/automation-core/ai-run'
import { isActiveRunStatus, terminalEventStatus } from '@/shared/model/automation-run-status'
import type { AutomationRun, AutomationRunEvent } from '@/shared/contracts/automation'

export const DEFAULT_AD_HOC_AI_TIMEOUT_MINUTES = 5

export const MAX_AD_HOC_AI_TIMEOUT_MINUTES = AUTOMATION_AI_RUN_MAX_TIMEOUT_MS / 60_000

export const clampAdHocTimeoutMinutes = (value: number) =>
  Math.min(MAX_AD_HOC_AI_TIMEOUT_MINUTES, Math.max(1, Math.trunc(value || 1)))

export type ChatTurnStatus =
  'waiting-for-history' | 'queued' | 'starting' | 'running' | 'canceling' | 'success' | 'failed' | 'canceled'

export interface ChatTurn {
  id: string
  prompt: string
  status: ChatTurnStatus
  run: AutomationRun | null
  events: AutomationRunEvent[]
  error?: string | null
  rawShellPolicy?: 'deny' | 'allowlisted'
}

export const runStatusToTurnStatus = (status: AutomationRun['status']): ChatTurnStatus => {
  if (status === 'queued' || status === 'running') return 'running'
  return status
}

export const chatTurnFromRun = (run: AutomationRun, events: AutomationRunEvent[]): ChatTurn => {
  const userEvent = events.find(event => event.type === 'ai.user.message')
  const clientMessageId =
    userEvent && typeof userEvent.data.clientMessageId === 'string' ? userEvent.data.clientMessageId : run.id
  const terminalEvent = events.findLast(event => terminalEventStatus(event) !== null)
  const terminal = terminalEvent && terminalEventStatus(terminalEvent)
  const restoredRun = terminal && isActiveRunStatus(run.status) ? { ...run, status: terminal } : run
  return {
    id: clientMessageId,
    prompt: userEvent?.message || 'Ad-hoc AI run',
    status: runStatusToTurnStatus(restoredRun.status),
    run: restoredRun,
    events
  }
}
