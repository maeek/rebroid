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

const VisualAffordanceNote = ({ data }: { data: Record<string, unknown> }) => {
  const affordances = typeof data.visualAffordances === 'string' ? data.visualAffordances.trim() : ''
  if (!affordances) return null
  return <AiAssistantText muted>{affordances}</AiAssistantText>
}

const UiXmlNote = ({ data }: { data: Record<string, unknown> }) => {
  const status = typeof data.uiStatus === 'string' ? data.uiStatus : ''
  if (!status || status === 'unavailable') return null
  const nodes = typeof data.uiNodes === 'number' ? data.uiNodes : null
  const detections = typeof data.uiDetectionCount === 'number' ? data.uiDetectionCount : null
  const rawNodes = typeof data.uiRawNodeCount === 'number' ? data.uiRawNodeCount : null
  const error = typeof data.uiError === 'string' ? data.uiError : ''
  const details =
    status === 'available'
      ? `UI XML available: ${nodes ?? 0} node(s), ${detections ?? 0} labeled detection(s).`
      : `UI XML ${status}${rawNodes !== null ? `, raw nodes ${rawNodes}` : ''}${error ? `: ${error}` : ''}`
  return <AiAssistantText muted>{details}</AiAssistantText>
}

const OcrNote = ({ data }: { data: Record<string, unknown> }) => {
  const status = typeof data.ocrStatus === 'string' ? data.ocrStatus : ''
  if (!status || status === 'unavailable' || status === 'disabled') return null
  const count = typeof data.ocrTextCount === 'number' ? data.ocrTextCount : 0
  const elapsed = typeof data.ocrElapsedMs === 'number' ? `, ${data.ocrElapsedMs}ms` : ''
  const error = typeof data.ocrError === 'string' ? `: ${data.ocrError}` : ''
  return <AiAssistantText muted>{`OCR ${status}: ${count} text box(es)${elapsed}${error}`}</AiAssistantText>
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
        <UiXmlNote data={event.data} />
        <OcrNote data={event.data} />
        <VisionConfidenceNote data={event.data} />
        <VisualAffordanceNote data={event.data} />
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
        <OcrNote data={event.data} />
        <VisionConfidenceNote data={event.data} />
        <VisualAffordanceNote data={event.data} />
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
