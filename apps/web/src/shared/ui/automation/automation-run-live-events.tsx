'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { IconActivity, IconChevronRight, IconPlayerStop, IconRobot } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { getBff, sendBff } from '@/lib/http/bff'
import { cn } from '@/lib/utils'
import { workflowAuthorizationFailure, workflowRunFailureMessage } from '@/shared/model/workflow-run-failure'
import {
  AutomationRunStatusBadge,
  type AutomationRunDisplayStatus
} from '@/shared/ui/automation/automation-run-status-badge'
import { DateTimeValue } from '@/shared/ui/date-time-value'
import { JsonViewer } from '@/shared/ui/json-viewer'
import { StateView } from '@/shared/ui/state-view'
import type { AutomationRun, AutomationRunEvent, AutomationRunStatus } from '@/shared/contracts/automation'

const activeStatuses = new Set<AutomationRunStatus>(['queued', 'running'])
const terminalStatuses = new Set<AutomationRunStatus>(['success', 'failed', 'canceled'])

const statusFromEvent = (event: AutomationRunEvent): AutomationRunStatus | null => {
  if (event.type === 'run.started') return 'running'
  if (event.type === 'run.completed') return 'success'
  if (event.type === 'run.failed') return 'failed'
  if (event.type === 'run.canceled') return 'canceled'
  return null
}

const eventPresentation = (type: AutomationRunEvent['type']) => {
  if (type.endsWith('.failed') || type === 'ai.guardrail.triggered') {
    return {
      row: 'border-danger/18 bg-danger/6 text-danger',
      marker: 'bg-danger'
    }
  }
  if (type === 'run.completed' || type === 'step.completed' || type === 'ai.tool.completed') {
    return {
      row: 'border-success/15 bg-success/5 text-foreground',
      marker: 'bg-success'
    }
  }
  if (type === 'run.started' || type === 'step.started' || type.startsWith('ai.model')) {
    return {
      row: 'border-primary/15 bg-primary/5 text-foreground',
      marker: 'bg-primary'
    }
  }
  return {
    row: 'border-transparent text-foreground-muted',
    marker: 'bg-foreground-muted/55'
  }
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
    <details
      className='group border-b border-surface-border/50'
      onToggle={change => setOpen(change.currentTarget.open)}
    >
      <summary className='flex cursor-pointer items-start gap-2 rounded-control px-2 py-2 text-sm hover:bg-control/35 focus-visible:outline-ring'>
        <IconChevronRight
          aria-hidden
          className='mt-0.5 size-4 shrink-0 group-open:rotate-90'
        />
        <span
          className={cn('mt-1.5 size-2 shrink-0 rounded-full', eventPresentation(event.type).marker)}
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
      </summary>
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
          ) : Object.keys(event.data).length ? (
            <JsonViewer
              value={event.data}
              title='Event data'
            />
          ) : null}
        </div>
      ) : null}
    </details>
  )
}

const runTimeLabel = (run: Pick<AutomationRun, 'startedAt' | 'createdAt'>) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(run.startedAt ?? run.createdAt))

export function AutomationRunLiveEvents({
  run,
  compact = false,
  showHeader = true,
  allowCancel = true,
  presentation = 'panel',
  onStatusChange
}: {
  run: Pick<AutomationRun, 'id' | 'status' | 'trigger' | 'startedAt' | 'createdAt'>
  compact?: boolean
  showHeader?: boolean
  allowCancel?: boolean
  presentation?: 'panel' | 'flat'
  onStatusChange?: (status: AutomationRun['status']) => void
}) {
  const [events, setEvents] = useState<AutomationRunEvent[]>([])
  const [localStatus, setLocalStatus] = useState<AutomationRunStatus>(run.status)
  const [isCanceling, setIsCanceling] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [hasLoadedEvents, setHasLoadedEvents] = useState(false)
  const lastSequenceRef = useRef(0)
  const cancelingRunIdRef = useRef<string | null>(null)
  const statusRef = useRef<AutomationRunStatus>(run.status)
  const onStatusChangeRef = useRef(onStatusChange)
  const runId = run.id
  const flat = presentation === 'flat'
  const recorded = flat && terminalStatuses.has(run.status)

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  useEffect(() => {
    statusRef.current = run.status
    setLocalStatus(run.status)
    if (terminalStatuses.has(run.status)) {
      cancelingRunIdRef.current = null
      setIsCanceling(false)
    }
  }, [run.id, run.status])

  useEffect(() => {
    let closed = false
    let socket: WebSocket | null = null
    let reconnectTimer: number | null = null
    lastSequenceRef.current = 0
    setEvents([])
    setStreamError(null)
    setHasLoadedEvents(false)

    const applyStatus = (status: AutomationRunStatus) => {
      statusRef.current = status
      setLocalStatus(status)
      onStatusChangeRef.current?.(status)
      if (terminalStatuses.has(status)) {
        cancelingRunIdRef.current = null
        setIsCanceling(false)
        socket?.close()
      }
    }

    const appendEvents = (nextEvents: AutomationRunEvent[]) => {
      for (const event of nextEvents) lastSequenceRef.current = Math.max(lastSequenceRef.current, event.sequence)
      setEvents(current => {
        const byId = new Map(current.map(event => [event.id, event]))
        for (const event of nextEvents) {
          byId.set(event.id, event)
        }
        return [...byId.values()].sort((left, right) => left.sequence - right.sequence)
      })
      for (const event of nextEvents) {
        if (terminalStatuses.has(statusRef.current)) break
        const nextStatus = statusFromEvent(event)
        if (nextStatus) applyStatus(nextStatus)
      }
    }

    const connect = async () => {
      try {
        let streamUrl = ''
        let hasMore = true
        while (hasMore && !closed) {
          const after = lastSequenceRef.current
          const live = await getBff<{ events: AutomationRunEvent[]; hasMore?: boolean; streamUrl: string }>(
            `/api/bff/automations/runs/${encodeURIComponent(runId)}/events?after=${after}`
          )
          if (closed) return
          setStreamError(null)
          appendEvents(live.events)
          streamUrl = live.streamUrl
          hasMore = live.hasMore === true && lastSequenceRef.current > after && !activeStatuses.has(statusRef.current)
        }
        if (closed) return
        setHasLoadedEvents(true)
        if (!activeStatuses.has(statusRef.current)) return
        socket = new WebSocket(streamUrl)
        socket.onmessage = message => {
          if (closed) return
          try {
            const payload = JSON.parse(String(message.data)) as { type: string; event?: AutomationRunEvent }
            if (payload.type === 'event' && payload.event) appendEvents([payload.event])
          } catch {
            setStreamError('A live event could not be read.')
          }
        }
        socket.onclose = () => {
          if (!closed && activeStatuses.has(statusRef.current)) {
            reconnectTimer = window.setTimeout(() => void connect(), 1500)
          }
        }
      } catch {
        if (!closed)
          setStreamError(recorded ? 'Could not load recorded events.' : 'Live updates are temporarily unavailable.')
      }
    }

    void connect()
    return () => {
      closed = true
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [recorded, runId])

  const visibleEvents = useMemo(
    () => events.filter(event => event.type !== 'heartbeat' && (flat || event.message.trim().length > 0)),
    [events, flat]
  )

  const cancel = async () => {
    if (isCanceling || cancelingRunIdRef.current === runId || !activeStatuses.has(localStatus)) return
    const previousStatus = localStatus
    cancelingRunIdRef.current = runId
    statusRef.current = 'canceled'
    setIsCanceling(true)
    setStreamError(null)
    try {
      const canceledRun = await sendBff<AutomationRun>(
        `/api/bff/automations/runs/${encodeURIComponent(runId)}/cancel`,
        {}
      )
      statusRef.current = canceledRun.status
      setLocalStatus(canceledRun.status)
      onStatusChangeRef.current?.(canceledRun.status)
    } catch {
      cancelingRunIdRef.current = null
      statusRef.current = previousStatus
      setLocalStatus(previousStatus)
      setStreamError('The run could not be stopped. Its latest status has been restored.')
    } finally {
      setIsCanceling(false)
    }
  }

  const displayStatus: AutomationRunDisplayStatus = isCanceling ? 'canceling' : localStatus
  const canCancel = allowCancel && activeStatuses.has(localStatus)
  const waitingForEvents = !hasLoadedEvents || activeStatuses.has(localStatus)

  return (
    <div
      className={cn(
        'grid min-h-0',
        !flat &&
          'overflow-hidden rounded-panel border border-surface-border/60 bg-surface-panel/45 shadow-[0_18px_48px_-38px_rgba(0,0,0,0.75)]'
      )}
    >
      {showHeader ? (
        <div className='flex flex-wrap items-center justify-between gap-3 border-b border-surface-border/50 bg-surface-band/24 px-4 py-3'>
          <div className='flex min-w-0 items-center gap-3'>
            <span className='flex size-9 shrink-0 items-center justify-center rounded-panel border border-primary/20 bg-primary/8 text-primary'>
              <IconRobot className='size-4.5' />
            </span>
            <div className='min-w-0'>
              <div className='truncate text-sm font-medium'>Run {runId.slice(0, 8)}</div>
              <div className='mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-foreground-muted'>
                <span className='capitalize'>{run.trigger}</span>
                <span aria-hidden='true'>·</span>
                <span className='truncate'>{runTimeLabel(run)}</span>
              </div>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <AutomationRunStatusBadge status={displayStatus} />
            {canCancel ? (
              <Button
                type='button'
                variant='outline'
                size='sm'
                aria-label='Stop automation run'
                disabled={isCanceling}
                onClick={() => void cancel()}
              >
                <IconPlayerStop className='size-3.5' />
                {isCanceling ? 'Stopping' : 'Stop'}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        role='log'
        aria-label={`Events for run ${runId.slice(0, 8)}`}
        aria-live='polite'
        className={
          flat ? 'grid min-w-0' : cn('grid gap-1.5 overflow-auto p-3', compact ? 'max-h-[28rem]' : 'max-h-[32rem]')
        }
      >
        {flat && !streamError && visibleEvents.length === 0 ? (
          <StateView
            scope='section'
            kind={waitingForEvents ? 'loading' : 'empty'}
            title={waitingForEvents ? 'Waiting for events' : 'No recorded events'}
            description={
              activeStatuses.has(localStatus)
                ? 'Events will appear as the workflow runs.'
                : 'Use Summary to inspect the run outcome.'
            }
          />
        ) : null}
        {!flat && visibleEvents.length === 0 ? (
          <div className='flex min-h-28 flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-surface-border/60 bg-surface-band/15 text-center'>
            <span className='flex size-8 items-center justify-center rounded-full bg-primary/8 text-primary'>
              <IconActivity className={cn('size-4', activeStatuses.has(localStatus) && 'animate-pulse')} />
            </span>
            <div>
              <p className='text-sm font-medium text-foreground'>
                {activeStatuses.has(localStatus) ? 'Waiting for activity' : 'No recorded events'}
              </p>
              <p className='mt-0.5 text-xs text-foreground-muted'>
                {activeStatuses.has(localStatus)
                  ? 'New events will appear here as the run progresses.'
                  : 'Use the run summary and step results to inspect this completed execution.'}
              </p>
            </div>
          </div>
        ) : null}
        {flat
          ? visibleEvents.map(event => (
              <ExpandableRunEvent
                key={event.id}
                event={event}
                startedAt={run.startedAt}
              />
            ))
          : visibleEvents.map(event => {
              const rowStyle = eventPresentation(event.type)
              return (
                <div
                  key={event.id}
                  className={cn(
                    'grid grid-cols-[2.25rem_0.5rem_minmax(0,1fr)] items-start gap-2 rounded-panel border px-2.5 py-2 text-xs transition-colors',
                    rowStyle.row
                  )}
                >
                  <span className='pt-px text-right font-mono text-xs text-foreground-muted/75'>
                    {String(event.sequence).padStart(3, '0')}
                  </span>
                  <span className={cn('mt-1 size-1.5 rounded-full', rowStyle.marker)} />
                  <span className='min-w-0 leading-5 break-words'>{eventLabel(event)}</span>
                </div>
              )
            })}
        {streamError && flat ? (
          <Notice
            tone='warning'
            description={streamError}
          />
        ) : null}
        {streamError && !flat ? (
          <div className='rounded-panel border border-warning/25 bg-warning/8 px-3 py-2 text-xs text-warning'>
            {streamError}
          </div>
        ) : null}
      </div>
    </div>
  )
}
