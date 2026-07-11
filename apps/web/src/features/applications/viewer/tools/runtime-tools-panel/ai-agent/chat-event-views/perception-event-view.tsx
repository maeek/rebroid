import type { ReactNode } from 'react'
import { IconChevronDown, IconEye } from '@tabler/icons-react'
import { AiAssistantText, AiToolDetails } from '@/shared/ui/ai/ai-message'
import { ObservationEventDetails } from './observation-event-details'
import { observationValues } from './observation-values'
import { perceptionSummary } from './perception-event-summary'
import { ToolEventRow } from './tool-event-view'
import type { PerceptionTimelineItem } from '../ai-agent-chat-event-utils'

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
    <details
      className='group overflow-hidden rounded-panel border border-surface-border/55 bg-surface-band/24 text-xs text-foreground-muted'
      data-testid='perception-disclosure'
    >
      <summary className='flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-foreground/3'>
        <span className='flex size-7 shrink-0 items-center justify-center rounded-panel border border-primary/20 bg-primary/8 text-primary'>
          <IconEye className='size-4' />
        </span>
        <span className='grid min-w-0 flex-1 text-left'>
          <span className='font-medium text-foreground'>Inspected screen</span>
          {summary ? <span className='truncate text-xs'>{summary}</span> : null}
        </span>
        <IconChevronDown className='size-3.5 transition-transform duration-150 group-open:rotate-180' />
      </summary>
      <div className='px-3 pb-3'>
        <AiToolDetails>
          <ObservationEventDetails
            label={label}
            values={includeObservationValues ? observationValues(data, { dimensions: true }) : []}
          />
          <UiXmlNote data={data} />
          <OcrNote data={data} />
          <VisionConfidenceNote data={data} />
          <VisibleTextNote data={data} />
          <VisualAffordanceNote data={data} />
        </AiToolDetails>
      </div>
    </details>
  )
}

export const PerceptionEventView = ({ item }: { item: PerceptionTimelineItem }) => {
  const data = {
    ...item.observed.data,
    ...item.summary?.data
  }
  const summary = perceptionSummary(data)
  return (
    <div className='text-xs text-foreground-muted'>
      <details className='group overflow-hidden rounded-panel border border-surface-border/55 bg-surface-band/24'>
        <summary className='flex cursor-pointer list-none items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-foreground/3'>
          <span className='flex size-7 shrink-0 items-center justify-center rounded-panel border border-primary/20 bg-primary/8 text-primary'>
            <IconEye className='size-4' />
          </span>
          <span className='grid min-w-0 flex-1 text-left'>
            <span className='font-medium text-foreground'>Inspected screen</span>
            {summary ? <span className='truncate text-xs'>{summary}</span> : null}
          </span>
          <IconChevronDown className='size-3.5 transition-transform duration-150 group-open:rotate-180' />
        </summary>
        <div className='px-3 pb-3'>
          <AiToolDetails>
            <ToolEventRow
              item={{
                key: 'event',
                value: item.summary?.message || item.observed.message,
                format: 'inline'
              }}
            />
            {observationValues(item.observed.data, { dimensions: true }).map(value => (
              <ToolEventRow
                key={value}
                item={{ key: 'capture', value, format: 'inline' }}
              />
            ))}
            <PerceptionRows data={data} />
          </AiToolDetails>
        </div>
      </details>
    </div>
  )
}

const textRow = (key: string, value: string, format: 'inline' | 'pre' = 'inline') => (
  <ToolEventRow
    key={key}
    item={{ key, value, format }}
  />
)

const PerceptionRows = ({ data }: { data: Record<string, unknown> }) => {
  const rows: ReactNode[] = []
  const uiStatus = typeof data.uiStatus === 'string' ? data.uiStatus : ''
  const uiError = typeof data.uiError === 'string' ? data.uiError : ''
  const uiNodes = typeof data.uiNodes === 'number' ? data.uiNodes : null
  const uiDetections = typeof data.uiDetectionCount === 'number' ? data.uiDetectionCount : null
  if (uiStatus && uiStatus !== 'unavailable') {
    rows.push(
      textRow(
        'UI XML',
        `${uiStatus}${uiNodes !== null ? `, nodes ${uiNodes}` : ''}${
          uiDetections !== null ? `, detections ${uiDetections}` : ''
        }${uiError ? `: ${uiError}` : ''}`,
        uiError.length > 120 ? 'pre' : 'inline'
      )
    )
  }

  const ocrStatus = typeof data.ocrStatus === 'string' ? data.ocrStatus : ''
  if (ocrStatus && ocrStatus !== 'unavailable') {
    const count = typeof data.ocrTextCount === 'number' ? data.ocrTextCount : 0
    const mode = typeof data.ocrPreprocessingMode === 'string' ? `, mode ${data.ocrPreprocessingMode}` : ''
    const error = typeof data.ocrError === 'string' ? `: ${data.ocrError}` : ''
    rows.push(
      textRow('OCR', `${ocrStatus}, ${count} text box(es)${mode}${error}`, error.length > 120 ? 'pre' : 'inline')
    )
  }

  if (Array.isArray(data.ocrPreprocessingAttempts) && data.ocrPreprocessingAttempts.length > 0) {
    rows.push(textRow('OCR attempts', JSON.stringify(data.ocrPreprocessingAttempts), 'pre'))
  }

  const screenKind = typeof data.screenKind === 'string' ? data.screenKind : ''
  const confidence = typeof data.visionConfidence === 'number' ? `${Math.round(data.visionConfidence * 100)}%` : ''
  if (screenKind || confidence) {
    rows.push(textRow('vision', [screenKind, confidence].filter(Boolean).join(', ')))
  }

  const correction = typeof data.screenKindCorrectionReason === 'string' ? data.screenKindCorrectionReason : ''
  if (correction) {
    rows.push(textRow('correction', correction))
  }

  const visibleText = Array.isArray(data.visibleText)
    ? data.visibleText.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : []
  if (visibleText.length > 0) {
    rows.push(textRow('visible text', visibleText.slice(0, 20).join(', '), 'pre'))
  }

  const affordances = typeof data.visualAffordances === 'string' ? data.visualAffordances.trim() : ''
  if (affordances) {
    rows.push(textRow('affordances', affordances, 'pre'))
  }

  return <>{rows}</>
}
