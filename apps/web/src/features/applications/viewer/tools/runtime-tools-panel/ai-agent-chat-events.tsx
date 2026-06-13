import { IconSparkles } from '@tabler/icons-react'
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
      <div className='ml-auto max-w-[85%] rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground'>
        {turn.prompt}
      </div>
      <div className='grid gap-2 py-3'>
        <div className='flex items-center justify-start gap-3'>
          <div className='flex min-w-0 items-center gap-2'>
            <IconSparkles className='size-4 shrink-0 text-primary' />
            <span className='truncate text-sm font-medium'>AI agent</span>
          </div>
          <ChatStatusBadge status={turn.status}>{chatTurnTitle(turn)}</ChatStatusBadge>
        </div>
        {turn.error ? <div className='text-xs text-destructive'>{turn.error}</div> : null}
        {turn.status === 'queued' ? (
          <div className='text-sm text-foreground-muted'>
            Waiting for the active run to finish. Use Run next to start it.
          </div>
        ) : null}
        {visibleEvents.length === 0 && turn.status !== 'queued' ? (
          <div className='text-sm text-foreground-muted'>Waiting for the agent to start...</div>
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
          <div className='whitespace-pre-wrap text-sm text-foreground'>
            {streamingText}
            <span className='ml-0.5 animate-pulse text-primary'>▍</span>
          </div>
        ) : null}
        {isWorking && !hasFinalResponse ? <WorkingIndicator status={turn.status} /> : null}
      </div>
    </article>
  )
}
