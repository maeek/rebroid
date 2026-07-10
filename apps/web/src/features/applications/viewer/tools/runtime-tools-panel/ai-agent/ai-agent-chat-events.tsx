import { AiAssistantBlock, AiAssistantMarkdownText, AiAssistantText, AiUserMessage } from '@/shared/ui/ai/ai-message'
import { buildTimelineItems } from './ai-agent-chat-event-utils'
import { nonPlanEvents, planForTurn } from './ai-agent-chat-presentation'
import {
  chatTurnHasFinalResponse,
  chatTurnIsWorking,
  chatTurnStreamingText,
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
  turn
}: {
  canSaveWorkflow?: boolean
  isSavingWorkflow?: boolean
  onApproveEscalation?: (program: string) => void
  onSaveWorkflow?: (turn: ChatTurn) => void
  turn: ChatTurn
}) => {
  const visibleEvents = nonPlanEvents(visibleChatTurnEvents(turn))
  const timelineItems = buildTimelineItems(visibleEvents)
  const plan = planForTurn(turn)
  const isWorking = chatTurnIsWorking(turn)
  const hasFinalResponse = chatTurnHasFinalResponse(turn)
  const streamingText = chatTurnStreamingText(turn)
  return (
    <article className='grid gap-4 py-1 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300'>
      <AiUserMessage>{turn.prompt}</AiUserMessage>
      <AiAssistantBlock
        title='Agent'
        meta={<ChatStatusBadge status={turn.status}>{chatTurnTitle(turn)}</ChatStatusBadge>}
      >
        {turn.error ? <div className='text-xs text-destructive'>{turn.error}</div> : null}
        {turn.status === 'queued' ? (
          <AiAssistantText muted>Waiting for the active run to finish. Use Run next to start it.</AiAssistantText>
        ) : null}
        {visibleEvents.length === 0 && turn.status !== 'queued' ? (
          <AiAssistantText muted>Waiting for the agent to start...</AiAssistantText>
        ) : null}
        {plan ? (
          <AgentPlanCard
            steps={plan.steps}
            updated={plan.event.type === 'ai.plan.updated'}
          />
        ) : null}
        {timelineItems.length > 0 ? (
          <div className='grid gap-2.5'>
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
                  onApproveEscalation={onApproveEscalation}
                />
              )
            )}
          </div>
        ) : null}
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
