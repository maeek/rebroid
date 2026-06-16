import { currentStreamingText, type ChatTurn } from './ai-agent-chat-utils'

export const visibleChatTurnEvents = (turn: ChatTurn) =>
  turn.events.filter(
    event => event.type !== 'heartbeat' && event.type !== 'ai.message.delta' && event.message.trim().length > 0
  )

export const chatTurnTitle = (turn: ChatTurn) => {
  if (turn.status === 'queued') return 'Queued'
  if (turn.status === 'starting') return 'Starting'
  if (turn.status === 'running') return 'Running'
  if (turn.status === 'canceling') return 'Canceling'
  if (turn.status === 'success') return 'Done'
  if (turn.status === 'canceled') return 'Canceled'
  return 'Failed'
}

export const chatTurnIsWorking = (turn: ChatTurn) =>
  turn.status === 'starting' || turn.status === 'running' || turn.status === 'canceling'

export const chatTurnHasFinalResponse = (turn: ChatTurn) =>
  turn.events.some(
    event => event.type === 'ai.message.completed' || event.type === 'run.failed' || event.type === 'run.canceled'
  )

export const chatTurnStreamingText = (turn: ChatTurn) =>
  turn.events.some(event => event.type === 'ai.message.completed') ? '' : currentStreamingText(turn)
