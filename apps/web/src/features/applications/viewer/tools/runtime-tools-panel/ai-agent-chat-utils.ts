import type { AutomationRun, AutomationRunEvent } from '@/server/orchestrator/automations/types'

export const activeRunStatuses = new Set<AutomationRun['status']>(['queued', 'running'])
export const terminalRunStatuses = new Set<AutomationRun['status']>(['success', 'failed', 'canceled'])
export const DEFAULT_AD_HOC_AI_TIMEOUT_MINUTES = 5

export const clampAdHocTimeoutMinutes = (value: number) => Math.min(120, Math.max(1, Math.trunc(value || 1)))

export type ChatTurnStatus = 'queued' | 'starting' | 'running' | 'canceling' | 'success' | 'failed' | 'canceled'
export type ChatConversationMessage = { role: 'user' | 'assistant'; content: string }

export interface ChatTurn {
  id: string
  prompt: string
  status: ChatTurnStatus
  run: AutomationRun | null
  events: AutomationRunEvent[]
  error?: string | null
}

export const updateRunStatusFromEvent = (event: AutomationRunEvent): AutomationRun['status'] | null => {
  if (event.type === 'run.started') return 'running'
  if (event.type === 'run.completed') return 'success'
  if (event.type === 'run.failed') return 'failed'
  if (event.type === 'run.canceled') return 'canceled'
  return null
}

export const runStatusToTurnStatus = (status: AutomationRun['status']): ChatTurnStatus => {
  if (status === 'queued' || status === 'running') return 'running'
  return status
}

export const chatTurnFromRun = (run: AutomationRun, events: AutomationRunEvent[]): ChatTurn => {
  const userEvent = events.find(event => event.type === 'ai.user.message')
  const clientMessageId =
    userEvent && typeof userEvent.data.clientMessageId === 'string' ? userEvent.data.clientMessageId : run.id
  return {
    id: clientMessageId,
    prompt: userEvent?.message || 'Ad-hoc AI run',
    status: runStatusToTurnStatus(run.status),
    run,
    events
  }
}

export const lastAssistantText = (turn: ChatTurn) =>
  [...turn.events]
    .reverse()
    .find(event => event.type === 'ai.message.completed')
    ?.message?.trim() ?? ''

export const currentStreamingText = (turn: ChatTurn) => {
  const lastCompletedIndex = turn.events.reduce(
    (latestIndex, event, index) => (event.type === 'ai.message.completed' ? index : latestIndex),
    -1
  )
  return turn.events
    .slice(lastCompletedIndex + 1)
    .filter(event => event.type === 'ai.message.delta')
    .map(event => event.message)
    .join('')
    .trim()
}

export const conversationBeforeTurn = (turnId: string, turns: ChatTurn[]): ChatConversationMessage[] => {
  const index = turns.findIndex(turn => turn.id === turnId)
  const priorTurns = index === -1 ? turns : turns.slice(0, index)
  return priorTurns
    .flatMap(turn => {
      const assistant = lastAssistantText(turn)
      return [
        { role: 'user' as const, content: turn.prompt },
        ...(assistant ? [{ role: 'assistant' as const, content: assistant }] : [])
      ]
    })
    .slice(-20)
}
