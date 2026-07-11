import { IconAlertTriangle, IconArrowRight, IconCircleX } from '@tabler/icons-react'
import { AiAssistantMarkdownText, AiAssistantText } from '@/shared/ui/ai/ai-message'
import { approvalRequestFromEvent } from '../ai-agent-chat-presentation'
import { ApprovalEventView } from './approval-event-view'
import { ObservationEventDetails } from './observation-event-details'
import { observationValues } from './observation-values'
import { PerceptionDisclosure } from './perception-event-view'
import { ReasoningEventView } from './reasoning-event-view'
import type { AutomationRunEvent } from '@/server/orchestrator/automations/types'

export const ChatEventView = ({
  event,
  onApproveEscalation
}: {
  event: AutomationRunEvent
  onApproveEscalation?: (program: string) => void
}) => {
  if (event.type === 'ai.user.message' || event.type === 'ai.message.delta') return null
  if (event.type === 'ai.screenshot.observed') {
    return (
      <ObservationEventDetails
        label={event.message}
        values={observationValues(event.data, { dimensions: true, bytes: true })}
      />
    )
  }
  if (event.type === 'ai.ui.observed') {
    return (
      <ObservationEventDetails
        label={event.message}
        values={observationValues(event.data, { nodeCount: true, bytes: true })}
      />
    )
  }
  if (event.type === 'ai.perception.observed') {
    return (
      <PerceptionDisclosure
        label={event.message}
        data={event.data}
        includeObservationValues
      />
    )
  }
  if (event.type === 'ai.message.completed') {
    return <AiAssistantMarkdownText text={event.message} />
  }
  if (event.type === 'ai.plan.proposed' || event.type === 'ai.plan.updated') {
    return null
  }
  if (event.type === 'ai.model.completed') {
    return <ReasoningEventView event={event} />
  }
  if (event.type === 'ai.orientation.completed' || event.type === 'ai.action.decided') {
    return (
      <div className='flex items-start gap-2 py-0.5 text-xs text-foreground-muted'>
        <span className='mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-control bg-primary/8 text-primary'>
          <IconArrowRight className='size-3.5' />
        </span>
        <span className='leading-5'>{event.message}</span>
      </div>
    )
  }
  if (event.type === 'ai.perception.summary') {
    return (
      <PerceptionDisclosure
        label={event.message}
        data={event.data}
      />
    )
  }
  if (event.type === 'ai.guardrail.triggered' && approvalRequestFromEvent(event)) {
    return (
      <ApprovalEventView
        event={event}
        onApprove={onApproveEscalation}
      />
    )
  }
  if (event.type === 'ai.tool.failed' || event.type === 'ai.guardrail.triggered' || event.type === 'run.failed') {
    return (
      <div className='flex items-start gap-2 rounded-panel border border-danger/20 bg-danger/5 px-3 py-2 text-xs text-danger'>
        <IconAlertTriangle className='mt-0.5 size-3.5 shrink-0' />
        <span className='leading-5'>{event.message}</span>
      </div>
    )
  }
  if (event.type === 'run.canceled') {
    return (
      <AiAssistantText muted>
        <span className='flex items-center gap-2'>
          <IconCircleX className='size-4' /> Run canceled.
        </span>
      </AiAssistantText>
    )
  }
  if (event.type === 'run.started' || event.type === 'run.queued' || event.type === 'ai.model.started') return null
  return null
}
