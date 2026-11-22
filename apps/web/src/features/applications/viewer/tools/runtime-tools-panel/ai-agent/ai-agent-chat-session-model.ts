import { isActiveRunStatus, isTerminalRunStatus, terminalEventStatus } from '@/shared/model/automation-run-status'
import type { ChatTurn } from './ai-agent-chat-utils'
import type { AutomationRunEvent } from '@/shared/contracts/automation'

export const sortChatTurnsByRunCreatedAt = (turns: ChatTurn[]) =>
  [...turns].sort(
    (left, right) => new Date(left.run?.createdAt ?? '').getTime() - new Date(right.run?.createdAt ?? '').getTime()
  )

export const collectLatestRunSequences = (turns: ChatTurn[]) => {
  const sequences = new Map<string, number>()
  for (const turn of turns) {
    if (!turn.run || turn.events.length === 0) continue
    sequences.set(turn.run.id, latestEventSequence(0, turn.events))
  }
  return sequences
}

export const mergeHistoryTurns = (current: ChatTurn[], history: ChatTurn[]) => {
  const byRunId = new Map(history.filter(turn => turn.run).map(turn => [turn.run?.id, turn]))
  for (const turn of current) {
    if (!turn.run) continue
    const loaded = byRunId.get(turn.run.id)
    if (!loaded) {
      byRunId.set(turn.run.id, turn)
      continue
    }
    const latest =
      isTerminalRunStatus(turn.run.status) ||
      (turn.status === 'canceling' && loaded.run && isActiveRunStatus(loaded.run.status))
        ? { ...loaded, ...turn }
        : loaded
    byRunId.set(turn.run.id, mergeRunEventsIntoTurns([latest], turn.run.id, [...loaded.events, ...turn.events])[0])
  }
  const loadedIds = new Set([...byRunId.values()].map(turn => turn.id))
  return [...byRunId.values(), ...current.filter(turn => !turn.run && !loadedIds.has(turn.id))]
}

export const latestEventSequence = (fallbackSequence: number, events: AutomationRunEvent[]) =>
  events.reduce((latest, event) => Math.max(latest, event.sequence), fallbackSequence)

export const findActiveChatTurn = (turns: ChatTurn[]) =>
  turns.findLast(turn => (turn.run ? isActiveRunStatus(turn.run.status) : turn.status === 'starting')) ?? null

export const mergeRunEventsIntoTurns = (turns: ChatTurn[], runId: string, nextEvents: AutomationRunEvent[]) =>
  turns.map<ChatTurn>(turn => {
    if (turn.run?.id !== runId) return turn
    const byId = new Map(turn.events.map(event => [event.id, event]))
    for (const event of nextEvents) {
      byId.set(event.id, event)
    }
    const events = [...byId.values()].sort((left, right) => left.sequence - right.sequence)
    if (isTerminalRunStatus(turn.run.status)) return { ...turn, events }
    const status =
      findTerminalRunStatus(events) ?? (events.some(event => event.type === 'run.started') ? 'running' : null)
    if (!status || (status === 'running' && turn.status === 'canceling')) return { ...turn, events }
    return { ...turn, status, run: { ...turn.run, status }, events }
  })

export const findTerminalRunStatus = (events: AutomationRunEvent[]) => {
  for (const event of events) {
    const status = terminalEventStatus(event)
    if (status) return status
  }
  return null
}

export const createPromptTurn = ({
  id,
  prompt,
  status,
  rawShellPolicy = 'deny'
}: {
  id: string
  prompt: string
  status: 'queued' | 'starting' | 'waiting-for-history'
  rawShellPolicy?: ChatTurn['rawShellPolicy']
}): ChatTurn => ({
  id,
  prompt,
  status,
  run: null,
  events: [],
  rawShellPolicy
})
