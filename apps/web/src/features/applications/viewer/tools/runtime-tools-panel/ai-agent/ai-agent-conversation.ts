import type { RunAdHocAiAutomationInput } from '@/shared/contracts/automation'

export type AutomationAiConversationMessage = NonNullable<RunAdHocAiAutomationInput['conversation']>[number]

export interface AiConversationEvent {
  type: string
  message: string
}

export interface AiConversationTurn {
  id?: string
  prompt: string
  events: AiConversationEvent[]
}

const assistantCompletedEventType = 'ai.message.completed'
const assistantDeltaEventType = 'ai.message.delta'

export const lastAssistantText = (turn: AiConversationTurn) =>
  [...turn.events]
    .reverse()
    .find(event => event.type === assistantCompletedEventType)
    ?.message?.trim() ?? ''

export const currentStreamingText = (turn: AiConversationTurn) => {
  const lastCompletedIndex = turn.events.reduce(
    (latestIndex, event, index) => (event.type === assistantCompletedEventType ? index : latestIndex),
    -1
  )
  return turn.events
    .slice(lastCompletedIndex + 1)
    .filter(event => event.type === assistantDeltaEventType)
    .map(event => event.message)
    .join('')
    .trim()
}

export const conversationBeforeTurn = (
  turnId: string,
  turns: AiConversationTurn[],
  limit = 20
): AutomationAiConversationMessage[] => {
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
    .slice(-limit)
}
