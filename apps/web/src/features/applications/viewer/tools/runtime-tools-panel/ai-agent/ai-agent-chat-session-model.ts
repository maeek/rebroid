import { activeRunStatuses, terminalRunStatuses, updateRunStatusFromEvent, type ChatTurn } from './ai-agent-chat-utils'
import type { AutomationRunEvent } from '@/shared/contracts/automation'

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
  const byRunId = new Map(history.filter(turn => turn.run).map(turn => [turn.run?.id, turn]))
  for (const turn of current) {
    if (!turn.run) continue
    const loaded = byRunId.get(turn.run.id)
    if (!loaded) {
      byRunId.set(turn.run.id, turn)
      continue
    }
    const latest =
      terminalRunStatuses.has(turn.run.status) ||
      (turn.status === 'canceling' && loaded.run && activeRunStatuses.has(loaded.run.status))
        ? { ...loaded, ...turn }
        : loaded
    byRunId.set(turn.run.id, mergeRunEventsIntoTurns([latest], turn.run.id, [...loaded.events, ...turn.events])[0])
  }
  const loadedIds = new Set([...byRunId.values()].map(turn => turn.id))
  return [...current.filter(turn => !turn.run && !loadedIds.has(turn.id)), ...byRunId.values()]
}

export const latestEventSequence = (fallbackSequence: number, events: AutomationRunEvent[]) =>
  events.length === 0 ? fallbackSequence : Math.max(fallbackSequence, ...events.map(event => event.sequence))

export const findActiveChatTurn = (turns: ChatTurn[]) =>
  [...turns].reverse().find(turn => (turn.run ? activeRunStatuses.has(turn.run.status) : turn.status === 'starting')) ??
  null

export const mergeRunEventsIntoTurns = (turns: ChatTurn[], runId: string, nextEvents: AutomationRunEvent[]) =>
  turns.map(turn => {
    if (turn.run?.id !== runId) return turn
    const byId = new Map(turn.events.map(event => [event.id, event]))
    for (const event of nextEvents) {
      byId.set(event.id, event)
    }
    const events = [...byId.values()].sort((left, right) => left.sequence - right.sequence)
    if (terminalRunStatuses.has(turn.run.status)) return { ...turn, events }
    const status =
      findTerminalRunStatus(events) ?? (events.some(event => event.type === 'run.started') ? 'running' : null)
    if (!status || (status === 'running' && turn.status === 'canceling')) return { ...turn, events }
    return { ...turn, status, run: { ...turn.run, status }, events }
  })

export const findTerminalRunStatus = (events: AutomationRunEvent[]) =>
  events.map(updateRunStatusFromEvent).find(status => status && terminalRunStatuses.has(status)) ?? null

export const createPromptTurn = ({
  id,
  prompt,
  shouldQueue,
  rawShellPolicy = 'deny'
}: {
  id: string
  prompt: string
  shouldQueue: boolean
  rawShellPolicy?: ChatTurn['rawShellPolicy']
}): ChatTurn => ({
  id,
  prompt,
  status: shouldQueue ? 'queued' : 'starting',
  run: null,
  events: [],
  rawShellPolicy
})
