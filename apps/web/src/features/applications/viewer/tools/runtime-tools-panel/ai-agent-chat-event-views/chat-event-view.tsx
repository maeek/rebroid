import { AiAssistantMarkdownText, AiAssistantText } from '@/shared/ui/ai/ai-message'
import { ObservationEventDetails } from './observation-event-details'
import { observationValues } from './observation-values'
import type { AutomationRunEvent } from '@/server/orchestrator/automations/types'

export const ChatEventView = ({ event }: { event: AutomationRunEvent }) => {
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
      <ObservationEventDetails
        label={event.message}
        values={observationValues(event.data, { dimensions: true })}
      />
    )
  }
  if (event.type === 'ai.message.completed') {
    return <AiAssistantMarkdownText text={event.message} />
  }
  if (event.type === 'ai.perception.summary') {
    return <AiAssistantText muted>{event.message}</AiAssistantText>
  }
  if (event.type === 'ai.tool.failed' || event.type === 'ai.guardrail.triggered' || event.type === 'run.failed') {
    return <div className='text-xs text-destructive'>{event.message}</div>
  }
  if (event.type === 'run.canceled') {
    return <div className='text-xs text-destructive'>Run canceled.</div>
  }
  if (event.type === 'run.started' || event.type === 'run.queued' || event.type === 'ai.model.started') return null
  return null
}
