import { AiAssistantMarkdownText, AiAssistantText } from '@/shared/ui/ai/ai-message'
import { ObservationEventDetails } from './observation-event-details'
import { observationValues } from './observation-values'
import type { AutomationRunEvent } from '@/server/orchestrator/automations/types'

const VisionConfidenceNote = ({ data }: { data: Record<string, unknown> }) => {
  const correction = typeof data.screenKindCorrectionReason === 'string' ? data.screenKindCorrectionReason : ''
  const confidence = typeof data.visionConfidence === 'number' ? data.visionConfidence : null
  if (!correction && (confidence === null || confidence >= 0.5)) return null
  const confidenceText = confidence === null ? '' : `Vision confidence ${Math.round(confidence * 100)}%.`
  return <AiAssistantText muted>{[correction, confidenceText].filter(Boolean).join(' ')}</AiAssistantText>
}

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
      <div className='grid gap-1'>
        <ObservationEventDetails
          label={event.message}
          values={observationValues(event.data, { dimensions: true })}
        />
        <VisionConfidenceNote data={event.data} />
      </div>
    )
  }
  if (event.type === 'ai.message.completed') {
    return <AiAssistantMarkdownText text={event.message} />
  }
  if (event.type === 'ai.plan.proposed' || event.type === 'ai.plan.updated') {
    return <AiAssistantMarkdownText text={event.message} />
  }
  if (event.type === 'ai.orientation.completed' || event.type === 'ai.action.decided') {
    return <AiAssistantText muted>{event.message}</AiAssistantText>
  }
  if (event.type === 'ai.perception.summary') {
    return (
      <div className='grid gap-1'>
        <AiAssistantText muted>{event.message}</AiAssistantText>
        <VisionConfidenceNote data={event.data} />
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
