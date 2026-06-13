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
        values={observationValues(event.data, { dimensions: true, detections: true })}
      />
    )
  }
  if (event.type === 'ai.perception.summary' || event.type === 'ai.message.completed') {
    return (
      <div
        className={
          event.type === 'ai.message.completed'
            ? 'whitespace-pre-wrap text-sm text-foreground'
            : 'text-xs text-foreground-muted'
        }
      >
        {event.message}
      </div>
    )
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
