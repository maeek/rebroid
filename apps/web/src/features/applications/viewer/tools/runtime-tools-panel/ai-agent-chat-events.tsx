import { IconChevronDown, IconSparkles } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { currentStreamingText, type ChatTurn, type ChatTurnStatus } from './ai-agent-chat-utils'
import type { AutomationRunEvent } from '@/server/orchestrator/automations/types'

const compactJson = (value: unknown) => {
  if (!value || typeof value !== 'object') return ''
  try {
    const text = JSON.stringify(value)
    return text.length > 220 ? `${text.slice(0, 220)}...` : text
  } catch {
    return ''
  }
}

const runStatusBadgeVariant = (status: ChatTurnStatus) =>
  status === 'failed' || status === 'canceled' ? 'destructive' : 'secondary'

const chatTurnTitle = (turn: ChatTurn) => {
  if (turn.status === 'queued') return 'Queued'
  if (turn.status === 'starting') return 'Starting'
  if (turn.status === 'running') return 'Running'
  if (turn.status === 'canceling') return 'Canceling'
  if (turn.status === 'success') return 'Done'
  if (turn.status === 'canceled') return 'Canceled'
  return 'Failed'
}

const eventToolName = (event: AutomationRunEvent) =>
  typeof event.data.uses === 'string' ? event.data.uses : event.message

type ToolTimelineItem = {
  type: 'tool'
  key: string
  name: string
  status: 'using' | 'used' | 'failed'
  argumentsText: string
}

type EventTimelineItem =
  | {
      type: 'event'
      event: AutomationRunEvent
    }
  | ToolTimelineItem

const isToolEvent = (event: AutomationRunEvent) =>
  event.type === 'ai.tool.arguments' ||
  event.type === 'ai.tool.started' ||
  event.type === 'ai.tool.completed' ||
  event.type === 'ai.tool.failed'

const buildTimelineItems = (events: AutomationRunEvent[]): EventTimelineItem[] => {
  const items: EventTimelineItem[] = []
  let pendingTool: ToolTimelineItem | null = null

  const flushTool = () => {
    if (!pendingTool) return
    items.push(pendingTool)
    pendingTool = null
  }

  for (const event of events) {
    if (!isToolEvent(event)) {
      flushTool()
      items.push({ type: 'event', event })
      continue
    }

    const name = eventToolName(event)
    if (pendingTool && pendingTool.name !== name) {
      flushTool()
    }

    pendingTool ??= {
      type: 'tool',
      key: event.id,
      name,
      status: 'using',
      argumentsText: ''
    }

    if (event.type === 'ai.tool.arguments') {
      pendingTool.argumentsText = compactJson(event.data.arguments)
    }

    if (event.type === 'ai.tool.completed') {
      pendingTool.status = 'used'
      flushTool()
    }

    if (event.type === 'ai.tool.failed') {
      pendingTool.status = 'failed'
      flushTool()
    }
  }

  flushTool()
  return items
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
          <Badge
            variant={runStatusBadgeVariant(turn.status)}
            className='capitalize'
          >
            {chatTurnTitle(turn)}
          </Badge>
        </div>
        {turn.error ? <div className='text-xs text-destructive'>{turn.error}</div> : null}
        {turn.status === 'queued' ? (
          <div className='text-sm text-secondary-foreground'>
            Waiting for the active run to finish. Use Run next to start it.
          </div>
        ) : null}
        {visibleEvents.length === 0 && turn.status !== 'queued' ? (
          <div className='text-sm text-secondary-foreground'>Waiting for the agent to start...</div>
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

const WorkingIndicator = ({ status }: { status: ChatTurnStatus }) => (
  <div className='flex items-center gap-2 text-sm text-secondary-foreground'>
    <span className='motion-safe:animate-pulse'>{status === 'canceling' ? 'Canceling' : 'Working'}...</span>
    <span className='flex items-center gap-1'>
      <span className='size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]' />
      <span className='size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]' />
      <span className='size-1.5 animate-bounce rounded-full bg-primary' />
    </span>
  </div>
)

const ToolEventView = ({ item }: { item: ToolTimelineItem }) => {
  const label = item.status === 'failed' ? 'Tool failed' : item.status === 'used' ? 'Used tool' : 'Using tool'

  return (
    <details className='group text-xs text-muted-foreground'>
      <summary className='flex cursor-pointer list-none items-center gap-1'>
        <span>{label}</span>
        <span>({item.name})</span>
        {item.argumentsText ? <IconChevronDown className='size-3 transition-transform group-open:rotate-180' /> : null}
      </summary>
      {item.argumentsText ? (
        <pre className='mt-1 whitespace-pre-wrap break-words rounded-md bg-background/25 p-2 font-mono text-[11px] text-muted-foreground/80'>
          {item.argumentsText}
        </pre>
      ) : null}
    </details>
  )
}

const ChatEventView = ({ event }: { event: AutomationRunEvent }) => {
  if (event.type === 'ai.user.message' || event.type === 'ai.message.delta') return null
  if (event.type === 'ai.screenshot.observed') {
    const dimensions =
      typeof event.data.width === 'number' && typeof event.data.height === 'number'
        ? ` ${event.data.width}x${event.data.height}`
        : ''
    const bytes = typeof event.data.bytes === 'number' ? ` ${Math.round(event.data.bytes / 1024)} KB` : ''
    return (
      <div className='text-xs text-secondary-foreground'>
        {event.message}
        {dimensions || bytes ? (
          <span className='text-muted-foreground'>
            {' '}
            ({[dimensions.trim(), bytes.trim()].filter(Boolean).join(', ')})
          </span>
        ) : null}
      </div>
    )
  }
  if (event.type === 'ai.ui.observed') {
    const bytes = typeof event.data.bytes === 'number' ? ` ${Math.round(event.data.bytes / 1024)} KB` : ''
    const nodeCount = typeof event.data.nodeCount === 'number' ? ` ${event.data.nodeCount} nodes` : ''
    return (
      <div className='text-xs text-secondary-foreground'>
        {event.message}
        {bytes || nodeCount ? (
          <span className='text-muted-foreground'>
            {' '}
            ({[nodeCount.trim(), bytes.trim()].filter(Boolean).join(', ')})
          </span>
        ) : null}
      </div>
    )
  }
  if (event.type === 'ai.perception.observed') {
    const dimensions =
      typeof event.data.width === 'number' && typeof event.data.height === 'number'
        ? ` ${event.data.width}x${event.data.height}`
        : ''
    const detections = typeof event.data.detections === 'number' ? ` ${event.data.detections} detected` : ''
    return (
      <div className='text-xs text-secondary-foreground'>
        {event.message}
        {dimensions || detections ? (
          <span className='text-muted-foreground'>
            {' '}
            ({[dimensions.trim(), detections.trim()].filter(Boolean).join(', ')})
          </span>
        ) : null}
      </div>
    )
  }
  if (event.type === 'ai.perception.summary') {
    return <div className='text-xs text-secondary-foreground'>{event.message}</div>
  }
  if (event.type === 'ai.message.completed') {
    return <div className='whitespace-pre-wrap text-sm text-foreground'>{event.message}</div>
  }
  if (isToolEvent(event)) return null
  if (event.type === 'ai.tool.failed' || event.type === 'ai.guardrail.triggered' || event.type === 'run.failed') {
    return <div className='text-xs text-destructive'>{event.message}</div>
  }
  if (event.type === 'run.canceled') {
    return <div className='text-xs text-destructive'>Run canceled.</div>
  }
  if (event.type === 'run.started' || event.type === 'run.queued' || event.type === 'ai.model.started') {
    return <div className='text-xs text-secondary-foreground'>{event.message}</div>
  }
  return null
}
