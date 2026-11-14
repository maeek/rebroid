import { useId } from 'react'
import { Disclosure, DisclosureChevron, DisclosureSummary } from '@/components/ui/disclosure'
import { AiAssistantBlock, AiAssistantText, AiUserMessage } from '@/shared/ui/ai/ai-message'
import { buildTimelineItems, verifiedPerceptionItems, type EventTimelineItem } from './ai-agent-chat-event-utils'
import { nonPlanEvents, planForTurn } from './ai-agent-chat-presentation'
import {
  chatTurnHasFinalResponse,
  chatTurnIsWorking,
  chatTurnTitle,
  visibleChatTurnEvents
} from './ai-agent-chat-turn-model'
import { ChatTurnSaveWorkflowAction } from './ai-agent-chat-turn-save-action'
import { AgentPlanCard } from './chat-event-views/agent-plan-card'
import { ChatEventView } from './chat-event-views/chat-event-view'
import { ChatStatusBadge } from './chat-event-views/chat-status-badge'
import { PerceptionEventView } from './chat-event-views/perception-event-view'
import { ToolEventView } from './chat-event-views/tool-event-view'
import { WorkingIndicator } from './chat-event-views/working-indicator'
import type { ChatTurn } from './ai-agent-chat-utils'

export const ChatTurnView = ({
  canSaveWorkflow,
  isSavingWorkflow,
  onApproveEscalation,
  onSaveWorkflow,
  queueMessage,
  turn
}: {
  canSaveWorkflow?: boolean
  isSavingWorkflow?: boolean
  onApproveEscalation?: (program: string) => void
  onSaveWorkflow?: (turn: ChatTurn) => void
  queueMessage?: string
  turn: ChatTurn
}) => {
  const evidencePrefix = useId()
  const visibleEvents = nonPlanEvents(visibleChatTurnEvents(turn))
  const result = visibleEvents.findLast(event => event.type === 'ai.message.completed')
  const timelineItems = buildTimelineItems(
    visibleEvents.filter(
      event =>
        event !== result &&
        event.type !== 'ai.user.message' &&
        event.type !== 'ai.model.started' &&
        event.type !== 'run.started' &&
        event.type !== 'run.queued'
    )
  )
  const evidence = verifiedPerceptionItems(result, timelineItems)
  const blocked = result?.data.status === 'blocked'
  const failures = timelineItems.filter(item =>
    item.type === 'tool'
      ? item.status === 'failed'
      : item.type === 'event' && ['ai.guardrail.triggered', 'run.failed', 'run.canceled'].includes(item.event.type)
  )
  const activity = timelineItems.filter(
    item => !failures.includes(item) && !evidence.some(observation => observation === item)
  )
  const plan = planForTurn(turn)
  const isWorking = chatTurnIsWorking(turn)
  const hasFinalResponse = chatTurnHasFinalResponse(turn)
  const renderItem = (item: EventTimelineItem) => {
    if (item.type === 'tool')
      return (
        <ToolEventView
          key={item.key}
          item={item}
        />
      )
    if (item.type === 'perception')
      return (
        <PerceptionEventView
          key={item.key}
          item={item}
        />
      )
    return (
      <ChatEventView
        key={item.event.id}
        event={item.event}
        onApproveEscalation={onApproveEscalation}
      />
    )
  }
  const planCard = plan ? (
    <AgentPlanCard
      steps={plan.steps}
      updated={plan.event.type === 'ai.plan.updated'}
    />
  ) : null
  return (
    <article className='grid min-w-0 gap-5 py-1'>
      <AiUserMessage>{turn.prompt}</AiUserMessage>
      <AiAssistantBlock
        title='Agent'
        meta={
          <ChatStatusBadge
            status={turn.status}
            blocked={blocked}
          >
            {blocked ? 'Blocked' : chatTurnTitle(turn)}
          </ChatStatusBadge>
        }
      >
        {turn.error ? <div className='text-xs text-danger'>{turn.error}</div> : null}
        {turn.status === 'queued' && queueMessage ? <AiAssistantText muted>{queueMessage}</AiAssistantText> : null}
        {visibleEvents.length === 0 && turn.status === 'starting' ? (
          <AiAssistantText muted>Starting the task…</AiAssistantText>
        ) : null}
        {result ? <ChatEventView event={result} /> : null}
        {evidence.length > 0 ? (
          <div className='grid gap-2.5'>
            <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
              <span className='font-medium'>Verified observations</span>
              {evidence.map((item, index) => {
                const id = `${evidencePrefix}-observation-${index + 1}`
                return (
                  <a
                    key={item.key}
                    href={`#${id}`}
                    className='rounded-control text-primary underline underline-offset-2'
                    onClick={event => {
                      const details = document.getElementById(id)
                      if (!(details instanceof HTMLDetailsElement)) return
                      event.preventDefault()
                      details.open = true
                      details.querySelector('summary')?.focus({ preventScroll: true })
                      details.scrollIntoView({ block: 'nearest' })
                    }}
                  >
                    Observation {index + 1}
                  </a>
                )
              })}
            </div>
            {evidence.map((item, index) => (
              <PerceptionEventView
                key={item.key}
                item={item}
                id={`${evidencePrefix}-observation-${index + 1}`}
              />
            ))}
          </div>
        ) : null}
        {isWorking ? planCard : null}
        {failures.map(renderItem)}
        {isWorking && !hasFinalResponse ? activity.map(renderItem) : null}
        {(!isWorking || hasFinalResponse) && (activity.length > 0 || (!isWorking && planCard)) ? (
          <Disclosure>
            <DisclosureSummary className='flex w-fit cursor-pointer items-center gap-1 rounded-control text-xs text-foreground-muted'>
              <DisclosureChevron
                direction='right'
                className='size-3.5'
              />
              Task activity
            </DisclosureSummary>
            <div className='grid gap-2.5 pt-2'>
              {!isWorking ? planCard : null}
              {activity.map(renderItem)}
            </div>
          </Disclosure>
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
