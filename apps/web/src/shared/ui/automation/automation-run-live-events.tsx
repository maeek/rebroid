'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Disclosure, DisclosureSummary, DisclosureChevron } from '@/components/ui/disclosure'
import { Notice } from '@/components/ui/notice'
import { cn } from '@/lib/utils'
import { isActiveRunStatus } from '@/shared/model/automation-run-status'
import { workflowAuthorizationFailure, workflowRunFailureMessage } from '@/shared/model/workflow-run-failure'
import { WorkflowOcrExchangeDetails } from '@/shared/ui/automation/workflow-ocr-exchange-details'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { JsonViewer } from '@/shared/ui/json-viewer'
import { StateView } from '@/shared/ui/state-view'
import type { useAutomationRunEvents } from './use-automation-run-events'
import type { AutomationRun, AutomationRunEvent } from '@/shared/contracts/automation'

const eventMarkerColor = (type: AutomationRunEvent['type']) => {
  if (type.endsWith('.failed') || type === 'ai.guardrail.triggered') return 'bg-danger'
  if (type === 'run.completed' || type === 'step.completed' || type === 'ai.tool.completed') return 'bg-success'
  if (type === 'run.started' || type === 'step.started' || type.startsWith('ai.model')) return 'bg-primary'
  return 'bg-foreground-muted/55'
}

const textValue = (value: unknown) => (typeof value === 'string' ? value : '')

const eventLabel = (event: AutomationRunEvent) => {
  if (event.type === 'ai.tool.started') return `Using ${textValue(event.data.uses) || event.message}`
  if (event.type === 'ai.tool.arguments') return `Prepared ${textValue(event.data.uses) || event.message}`
  if (event.type === 'ai.tool.completed') return `Completed ${textValue(event.data.uses) || 'tool action'}`
  if (event.type === 'step.started') return event.stepId ? `Step ${event.stepId}` : event.message
  return event.message || event.type
}

const ExpandableRunEvent = ({ event, startedAt }: { event: AutomationRunEvent; startedAt: string | null }) => {
  const [open, setOpen] = useState(false)
  const failed = event.type === 'run.failed'
  const authorizationFailure = failed ? workflowAuthorizationFailure(event.data.code) : undefined
  const label =
    authorizationFailure?.title ?? (failed ? workflowRunFailureMessage(event.message, startedAt) : eventLabel(event))
  return (
    <Disclosure
      className='group border-b border-surface-border/50'
      onToggle={change => setOpen(change.currentTarget.open)}
    >
      <DisclosureSummary className='flex cursor-pointer items-start gap-2 rounded-control px-2 py-2 text-sm hover:bg-control/35 focus-visible:outline-ring'>
        <DisclosureChevron
          direction='right'
          className='mt-0.5 size-4 shrink-0'
        />
        <span
          className={cn('mt-1.5 size-2 shrink-0 rounded-full', eventMarkerColor(event.type))}
          aria-hidden
        />
        <span className='min-w-0 flex-1 [overflow-wrap:anywhere]'>{label}</span>
        <span className='hidden shrink-0 sm:inline'>
          <DateTimeValue
            value={event.createdAt}
            compact
            showSeconds
          />
        </span>
      </DisclosureSummary>
      {open ? (
        <div className='grid gap-2 px-4 pb-3'>
          <div className='flex flex-wrap items-center gap-2 text-xs text-foreground-muted'>
            <code>{event.type}</code>
            {event.stepId ? <span>Step {event.stepId}</span> : null}
            <span className='sm:hidden'>
              <DateTimeValue
                value={event.createdAt}
                compact
                showSeconds
              />
            </span>
          </div>
          {authorizationFailure ? (
            <div className='grid gap-1 text-sm text-foreground-muted'>
              <p>{authorizationFailure.description}</p>
              {typeof event.data.requestId === 'string' ? (
                <p className='text-xs'>
                  Request ID <code className='break-all'>{event.data.requestId}</code>
                </p>
              ) : null}
            </div>
          ) : event.type === 'vision.ocr.exchange' ? (
            <WorkflowOcrExchangeDetails data={event.data} />
          ) : Object.keys(event.data).length ? (
            <JsonViewer
              value={event.data}
              title='Event data'
            />
          ) : null}
        </div>
      ) : null}
    </Disclosure>
  )
}

export function AutomationRunEventsPanel({
  run,
  feed,
  ocrStep,
  onClearOcrStep
}: {
  run: Pick<AutomationRun, 'id' | 'startedAt'>
  feed: ReturnType<typeof useAutomationRunEvents>
  ocrStep?: { stepId: string; path?: string | null }
  onClearOcrStep?: () => void
}) {
  const { events, status, streamError, hasLoadedEvents } = feed
  const visibleEvents = useMemo(
    () =>
      events.filter(event => {
        if (ocrStep) {
          return (
            event.type === 'vision.ocr.exchange' &&
            event.stepId === ocrStep.stepId &&
            (!ocrStep.path || event.data.path === ocrStep.path)
          )
        }
        return event.type !== 'heartbeat'
      }),
    [events, ocrStep]
  )

  const active = isActiveRunStatus(status)
  const waitingForEvents = !hasLoadedEvents || active
  const emptyEventTitle = ocrStep ? 'No OCR exchange recorded' : 'No recorded events'
  const emptyEventDescription = ocrStep ? undefined : 'Use Summary to inspect the run outcome.'

  return (
    <div className='grid min-h-0'>
      {ocrStep ? (
        <div className='flex flex-wrap items-center justify-between gap-2 pb-2'>
          <span className='text-sm font-medium'>OCR events for {ocrStep.stepId}</span>
          <Button
            variant='ghost'
            size='sm'
            onClick={onClearOcrStep}
          >
            Show all events
          </Button>
        </div>
      ) : null}
      <div
        role='log'
        aria-label={`Events for run ${run.id.slice(0, 8)}`}
        aria-live='polite'
        className='grid min-w-0'
      >
        {!streamError && visibleEvents.length === 0 ? (
          <StateView
            scope='section'
            kind={waitingForEvents ? 'loading' : 'empty'}
            title={waitingForEvents ? 'Waiting for events' : emptyEventTitle}
            description={active ? 'Events will appear as the workflow runs.' : emptyEventDescription}
          />
        ) : null}
        {visibleEvents.map(event => (
          <ExpandableRunEvent
            key={event.id}
            event={event}
            startedAt={run.startedAt}
          />
        ))}
        {streamError ? (
          <Notice
            tone='warning'
            description={streamError}
          />
        ) : null}
      </div>
    </div>
  )
}
