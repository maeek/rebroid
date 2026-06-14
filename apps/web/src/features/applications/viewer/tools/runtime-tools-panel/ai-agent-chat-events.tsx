import { AiAssistantBlock, AiAssistantText, AiUserMessage } from '@/shared/ui/ai/ai-message'
import { buildTimelineItems } from './ai-agent-chat-event-utils'
import { ChatEventView } from './ai-agent-chat-event-views/chat-event-view'
import { ChatStatusBadge } from './ai-agent-chat-event-views/chat-status-badge'
import { ToolEventView } from './ai-agent-chat-event-views/tool-event-view'
import { WorkingIndicator } from './ai-agent-chat-event-views/working-indicator'
import { currentStreamingText, type ChatTurn } from './ai-agent-chat-utils'

const chatTurnTitle = (turn: ChatTurn) => {
  if (turn.status === 'queued') return 'Queued'
  if (turn.status === 'starting') return 'Starting'
  if (turn.status === 'running') return 'Running'
  if (turn.status === 'canceling') return 'Canceling'
  if (turn.status === 'success') return 'Done'
  if (turn.status === 'canceled') return 'Canceled'
  return 'Failed'
}

export const ChatTurnView = ({ turn }: { turn: ChatTurn }) => {
  const visibleEvents = turn.events.filter(
    event => event.type !== 'heartbeat' && event.type !== 'ai.message.delta' && event.message.trim().length > 0
  )
  const timelineItems = buildTimelineItems(visibleEvents)
  const isWorking = turn.status === 'starting' || turn.status === 'running' || turn.status === 'canceling'
  const hasFinalResponse = turn.events.some(
    event => event.type === 'ai.message.completed' || event.type === 'run.failed' || event.type === 'run.canceled'
  )
  const hasCompletedResponse = turn.events.some(event => event.type === 'ai.message.completed')
  const streamingText = hasCompletedResponse ? '' : currentStreamingText(turn)
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
          ) : (
            <ChatEventView
              key={item.event.id}
              event={item.event}
            />
          )
        )}
        {streamingText ? (
          <AiAssistantText>
            {streamingText}
            <span className='ml-0.5 animate-pulse text-primary'>▍</span>
          </AiAssistantText>
        ) : null}
        {isWorking && !hasFinalResponse ? <WorkingIndicator status={turn.status} /> : null}
      </AiAssistantBlock>
    </article>
  )
}
