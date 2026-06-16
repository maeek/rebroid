import {
  activeRunStatuses,
  terminalRunStatuses,
  updateRunStatusFromEvent,
  type ChatTurn,
  type ChatTurnStatus
} from './ai-agent-chat-utils'
import type { AutomationRunEvent } from '@/server/orchestrator/automations/types'

export const sortChatTurnsByRunCreatedAt = (turns: ChatTurn[]) =>
  [...turns].sort(
    (left, right) => new Date(left.run?.createdAt ?? '').getTime() - new Date(right.run?.createdAt ?? '').getTime()
  )

export const collectLatestRunSequences = (turns: ChatTurn[]) => {
  const sequences = new Map<string, number>()
  for (const turn of turns) {
    if (!turn.run || turn.events.length === 0) continue
    sequences.set(turn.run.id, Math.max(...turn.events.map(event => event.sequence)))
  }
  return sequences
}

export const mergeHistoryTurns = (current: ChatTurn[], history: ChatTurn[]) => {
  const byRunId = new Map(current.filter(turn => turn.run).map(turn => [turn.run?.id, turn]))
  const currentWithoutRuns = current.filter(turn => !turn.run)
  for (const turn of history) {
    if (!turn.run) continue
    byRunId.set(turn.run.id, turn)
  }
  return [...currentWithoutRuns, ...byRunId.values()]
}

export const findActiveHistoryTurnId = (turns: ChatTurn[]) =>
  [...turns].reverse().find(turn => turn.run && activeRunStatuses.has(turn.run.status))?.id ?? null

export const latestEventSequence = (fallbackSequence: number, events: AutomationRunEvent[]) =>
  events.length === 0 ? fallbackSequence : Math.max(fallbackSequence, ...events.map(event => event.sequence))

const projectChatTurnStatusFromEvents = (currentStatus: ChatTurnStatus, events: AutomationRunEvent[]) => {
  const statusEvent = events.map(updateRunStatusFromEvent).find(Boolean)
  const nextStatus =
    statusEvent === 'success'
      ? 'success'
      : statusEvent === 'failed'
        ? 'failed'
        : statusEvent === 'canceled'
          ? 'canceled'
          : statusEvent === 'running'
            ? 'running'
            : currentStatus
  return { runStatus: statusEvent, turnStatus: nextStatus }
}

export const mergeRunEventsIntoTurns = (turns: ChatTurn[], runId: string, nextEvents: AutomationRunEvent[]) =>
  turns.map(turn => {
    if (turn.run?.id !== runId) return turn
    const byId = new Map(turn.events.map(event => [event.id, event]))
    for (const event of nextEvents) {
      byId.set(event.id, event)
    }
    const { runStatus, turnStatus } = projectChatTurnStatusFromEvents(turn.status, nextEvents)
    return {
      ...turn,
      status: turnStatus,
      run: runStatus ? { ...turn.run, status: runStatus } : turn.run,
      events: [...byId.values()].sort((left, right) => left.sequence - right.sequence)
    }
  })

export const findTerminalRunStatus = (events: AutomationRunEvent[]) =>
  events.map(updateRunStatusFromEvent).find(status => status && terminalRunStatuses.has(status)) ?? null

export const createPromptTurn = ({
  id,
  prompt,
  hasActiveTurn
}: {
  id: string
  prompt: string
  hasActiveTurn: boolean
}): ChatTurn => ({
  id,
  prompt,
  status: hasActiveTurn ? 'queued' : 'starting',
  run: null,
  events: []
})
