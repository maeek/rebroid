'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { IconActivity, IconPlayerStop, IconRobot } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { getBff, sendBff } from '@/lib/http/bff'
import { cn } from '@/lib/utils'
import {
  AutomationRunStatusBadge,
  type AutomationRunDisplayStatus
} from '@/shared/ui/automation/automation-run-status-badge'
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

const runTimeLabel = (run: AutomationRun) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(run.startedAt ?? run.createdAt))

export function AutomationRunLiveEvents({
  run,
  compact = false,
  showHeader = true,
  allowCancel = true,
  onStatusChange
}: {
  run: AutomationRun
  compact?: boolean
  showHeader?: boolean
  allowCancel?: boolean
  onStatusChange?: (status: AutomationRun['status']) => void
}) {
  const [events, setEvents] = useState<AutomationRunEvent[]>([])
  const [localStatus, setLocalStatus] = useState<AutomationRunStatus>(run.status)
  const [isCanceling, setIsCanceling] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const lastSequenceRef = useRef(0)
  const cancelingRunIdRef = useRef<string | null>(null)
  const statusRef = useRef<AutomationRunStatus>(run.status)
  const onStatusChangeRef = useRef(onStatusChange)
  const runId = run.id

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
      setEvents(current => {
        const byId = new Map(current.map(event => [event.id, event]))
        for (const event of nextEvents) {
          byId.set(event.id, event)
          lastSequenceRef.current = Math.max(lastSequenceRef.current, event.sequence)
        }
        return [...byId.values()].sort((left, right) => left.sequence - right.sequence)
      })
      for (const event of nextEvents) {
        const nextStatus = statusFromEvent(event)
        if (nextStatus) applyStatus(nextStatus)
      }
    }

    const connect = async () => {
      try {
        const live = await getBff<{ events: AutomationRunEvent[]; streamUrl: string }>(
          `/api/bff/automations/runs/${encodeURIComponent(runId)}/events?after=${lastSequenceRef.current}`
        )
        appendEvents(live.events)
        if (closed || !activeStatuses.has(statusRef.current)) return
        if (closed || !activeStatuses.has(statusRef.current)) return
        socket = new WebSocket(live.streamUrl)
        socket.onmessage = message => {
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
        if (!closed) setStreamError('Live updates are temporarily unavailable.')
      }
    }

    void connect()
    return () => {
      closed = true
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [runId])

  const visibleEvents = useMemo(
    () => events.filter(event => event.type !== 'heartbeat' && event.message.trim().length > 0),
    [events]
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

  return (
    <div className='grid min-h-0 overflow-hidden rounded-panel border border-surface-border/60 bg-surface-panel/45 shadow-[0_18px_48px_-38px_rgba(0,0,0,0.75)]'>
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
        className={cn('grid gap-1.5 overflow-auto p-3', compact ? 'max-h-[28rem]' : 'max-h-[32rem]')}
      >
        {visibleEvents.length === 0 ? (
          <div className='flex min-h-28 flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-surface-border/60 bg-surface-band/15 text-center'>
            <span className='flex size-8 items-center justify-center rounded-full bg-primary/8 text-primary'>
              <IconActivity className={cn('size-4', activeStatuses.has(localStatus) && 'animate-pulse')} />
            </span>
            <div>
              <p className='text-sm font-medium text-foreground'>Waiting for activity</p>
              <p className='mt-0.5 text-xs text-foreground-muted'>New events will appear here as the run progresses.</p>
            </div>
          </div>
        ) : (
          visibleEvents.map(event => {
            const presentation = eventPresentation(event.type)
            return (
              <div
                key={event.id}
                className={cn(
                  'grid grid-cols-[2.25rem_0.5rem_minmax(0,1fr)] items-start gap-2 rounded-panel border px-2.5 py-2 text-xs transition-colors',
                  presentation.row
                )}
              >
                <span className='pt-px text-right font-mono text-xs text-foreground-muted/75'>
                  {String(event.sequence).padStart(3, '0')}
                </span>
                <span className={cn('mt-1 size-1.5 rounded-full', presentation.marker)} />
                <span className='min-w-0 leading-5 break-words'>{eventLabel(event)}</span>
              </div>
            )
          })
        )}
        {streamError ? (
          <div className='rounded-panel border border-warning/25 bg-warning/8 px-3 py-2 text-xs text-warning'>
            {streamError}
          </div>
        ) : null}
      </div>
    </div>
  )
}
