import { AiAssistantBlock, AiAssistantMarkdownText, AiAssistantText, AiUserMessage } from '@/shared/ui/ai/ai-message'
import { buildTimelineItems } from './ai-agent-chat-event-utils'
import { ChatEventView } from './ai-agent-chat-event-views/chat-event-view'
import { ChatStatusBadge } from './ai-agent-chat-event-views/chat-status-badge'
import { PerceptionEventView } from './ai-agent-chat-event-views/perception-event-view'
import { ToolEventView } from './ai-agent-chat-event-views/tool-event-view'
import { WorkingIndicator } from './ai-agent-chat-event-views/working-indicator'
import { ChatTurnSaveWorkflowAction } from './ai-agent-chat-turn-save-action'
import {
  chatTurnHasFinalResponse,
  chatTurnIsWorking,
  chatTurnStreamingText,
  chatTurnTitle,
  visibleChatTurnEvents
} from './ai-agent-chat-turn-model'
import type { ChatTurn } from './ai-agent-chat-utils'

export const ChatTurnView = ({
  canSaveWorkflow,
  isSavingWorkflow,
  onSaveWorkflow,
  turn
}: {
  canSaveWorkflow?: boolean
  isSavingWorkflow?: boolean
  onSaveWorkflow?: (turn: ChatTurn) => void
  turn: ChatTurn
}) => {
  const visibleEvents = visibleChatTurnEvents(turn)
  const timelineItems = buildTimelineItems(visibleEvents)
  const isWorking = chatTurnIsWorking(turn)
  const hasFinalResponse = chatTurnHasFinalResponse(turn)
  const streamingText = chatTurnStreamingText(turn)
  return (
    <article className='grid gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2'>
      <AiUserMessage>{turn.prompt}</AiUserMessage>
      <AiAssistantBlock meta={<ChatStatusBadge status={turn.status}>{chatTurnTitle(turn)}</ChatStatusBadge>}>
        {turn.error ? <div className='text-xs text-destructive'>{turn.error}</div> : null}
        {turn.status === 'queued' ? (
          <AiAssistantText muted>Waiting for the active run to finish. Use Run next to start it.</AiAssistantText>
        ) : null}
        {visibleEvents.length === 0 && turn.status !== 'queued' ? (
          <AiAssistantText muted>Waiting for the agent to start...</AiAssistantText>
        ) : null}
        {timelineItems.map(item =>
          item.type === 'tool' ? (
            <ToolEventView
              key={item.key}
              item={item}
            />
          ) : item.type === 'perception' ? (
            <PerceptionEventView
              key={item.key}
              item={item}
            />
          ) : (
            <ChatEventView
              key={item.event.id}
              event={item.event}
            />
          )
        )}
        {streamingText ? (
          <AiAssistantMarkdownText
            text={streamingText}
            cursor={<span className='ml-0.5 animate-pulse text-primary'>▍</span>}
          />
        ) : null}
        {isWorking && !hasFinalResponse ? <WorkingIndicator status={turn.status} /> : null}
        {canSaveWorkflow ? (
          <ChatTurnSaveWorkflowAction
            turn={turn}
            isSavingWorkflow={isSavingWorkflow}
            onSaveWorkflow={onSaveWorkflow}
          />
        ) : null}
      </AiAssistantBlock>
    </article>
  )
}
