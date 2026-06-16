import { AiAssistantText } from '@/shared/ui/ai/ai-message'
import { ObservationEventDetails } from './observation-event-details'
import { observationValues } from './observation-values'
import { perceptionSummary } from './perception-event-summary'

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
  const mode = typeof data.ocrPreprocessingMode === 'string' ? `, mode=${data.ocrPreprocessingMode}` : ''
  const error = typeof data.ocrError === 'string' ? `: ${data.ocrError}` : ''
  const attempts = Array.isArray(data.ocrPreprocessingAttempts)
    ? data.ocrPreprocessingAttempts
        .map(attempt => {
          if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt)) return ''
          const raw = attempt as Record<string, unknown>
          const attemptMode = typeof raw.mode === 'string' ? raw.mode : ''
          const attemptStatus = typeof raw.status === 'string' ? raw.status : ''
          const attemptCount = typeof raw.textBoxCount === 'number' ? ` ${raw.textBoxCount} box(es)` : ''
          return attemptMode && attemptStatus ? `${attemptMode}:${attemptStatus}${attemptCount}` : ''
        })
        .filter(Boolean)
    : []
  return (
    <AiAssistantText muted>
      {`OCR ${status}: ${count} text box(es)${elapsed}${mode}${error}${
        attempts.length > 0 ? `\nOCR attempts: ${attempts.join(', ')}` : ''
      }`}
    </AiAssistantText>
  )
}

const VisibleTextNote = ({ data }: { data: Record<string, unknown> }) => {
  const values = Array.isArray(data.visibleText)
    ? data.visibleText.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : []
  if (values.length === 0) return null
  return <AiAssistantText muted>{`Visible text: ${values.slice(0, 12).join(', ')}`}</AiAssistantText>
}

export const PerceptionDisclosure = ({
  label,
  data,
  includeObservationValues
}: {
  label: string
  data: Record<string, unknown>
  includeObservationValues?: boolean
}) => {
  const summary = perceptionSummary(data)
  return (
    <details className='group py-2 text-xs text-foreground-muted'>
      <summary className='cursor-pointer list-none select-none text-foreground-muted marker:hidden'>
        <span className='font-medium text-foreground'>Inspected screen</span>
        {summary ? <span className='ml-2 text-foreground-muted'>{summary}</span> : null}
      </summary>
      <div className='mt-2 grid gap-1 border-t border-border/50 pt-2'>
        <ObservationEventDetails
          label={label}
          values={includeObservationValues ? observationValues(data, { dimensions: true }) : []}
        />
        <UiXmlNote data={data} />
        <OcrNote data={data} />
        <VisionConfidenceNote data={data} />
        <VisibleTextNote data={data} />
        <VisualAffordanceNote data={data} />
      </div>
    </details>
  )
}
