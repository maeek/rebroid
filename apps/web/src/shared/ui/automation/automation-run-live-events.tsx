'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { IconPlayerStop } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  cancelAutomationRunAction,
  createAutomationRunEventStreamUrlAction,
  listAutomationRunEventsAction
} from '@/server/orchestrator/automations/automation-run-actions'
import type { AutomationRun, AutomationRunEvent } from '@/server/orchestrator/automations/types'

const activeStatuses = new Set(['queued', 'running'])
const terminalStatuses = new Set(['success', 'failed', 'canceled'])

const eventTone = (type: AutomationRunEvent['type']) => {
  if (type.endsWith('.failed') || type === 'ai.guardrail.triggered') return 'text-destructive'
  if (type.startsWith('ai.tool')) return 'text-secondary-foreground'
  if (type.startsWith('ai.message') || type.startsWith('ai.model')) return 'text-foreground'
  return 'text-secondary-foreground'
}

const textValue = (value: unknown) => (typeof value === 'string' ? value : '')

const eventLabel = (event: AutomationRunEvent) => {
  if (event.type === 'ai.tool.started') return `tool: ${textValue(event.data.uses) || event.message}`
  if (event.type === 'ai.tool.arguments') return `args: ${textValue(event.data.uses) || event.message}`
  if (event.type === 'ai.tool.completed') return `done: ${textValue(event.data.uses) || 'tool'}`
  if (event.type === 'step.started') return `step: ${event.stepId ?? event.message}`
  return event.message || event.type
}

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
  const [localStatus, setLocalStatus] = useState<AutomationRun['status']>(run.status)
  const [isCanceling, setIsCanceling] = useState(false)
  const lastSequenceRef = useRef(0)
  const cancelingRunIdRef = useRef<string | null>(null)

  useEffect(() => {
    let closed = false
    let socket: WebSocket | null = null
    lastSequenceRef.current = 0
    setEvents([])
    setLocalStatus(run.status)

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
        const nextStatus =
          event.type === 'run.started'
            ? 'running'
            : event.type === 'run.completed'
              ? 'success'
              : event.type === 'run.failed'
                ? 'failed'
                : event.type === 'run.canceled'
                  ? 'canceled'
                  : null
        if (nextStatus) {
          setLocalStatus(nextStatus)
          onStatusChange?.(nextStatus)
          if (terminalStatuses.has(nextStatus)) {
            cancelingRunIdRef.current = null
            setIsCanceling(false)
          }
        }
      }
    }

    const connect = async () => {
      appendEvents(await listAutomationRunEventsAction(run.id, lastSequenceRef.current))
      if (closed) return
      const url = await createAutomationRunEventStreamUrlAction(run.id, lastSequenceRef.current)
      if (closed) return
      socket = new WebSocket(url)
      socket.onmessage = event => {
        const payload = JSON.parse(String(event.data)) as { type: string; event?: AutomationRunEvent }
        if (payload.type === 'event' && payload.event) appendEvents([payload.event])
      }
      socket.onclose = () => {
        if (!closed && activeStatuses.has(run.status)) {
          window.setTimeout(() => void connect(), 1500)
        }
      }
    }

    void connect()
    return () => {
      closed = true
      socket?.close()
    }
  }, [onStatusChange, run.id, run.status])

  const visibleEvents = useMemo(
    () => events.filter(event => event.type !== 'heartbeat' && event.message.trim().length > 0),
    [events]
  )

  const cancel = async () => {
    if (isCanceling || cancelingRunIdRef.current === run.id) return
    cancelingRunIdRef.current = run.id
    setIsCanceling(true)
    setLocalStatus('canceled')
    try {
      await cancelAutomationRunAction(run.id)
    } catch {
      cancelingRunIdRef.current = null
      setIsCanceling(false)
      setLocalStatus(run.status)
    }
  }

  const displayStatus = isCanceling && activeStatuses.has(run.status) ? 'canceling' : localStatus

  return (
    <div className={compact ? 'grid gap-2' : 'grid gap-3 rounded-md border border-border/70 bg-background/40 p-3'}>
      {showHeader ? (
        <div className='flex items-center justify-between gap-3'>
          <div className='min-w-0'>
            <div className='truncate text-sm font-medium'>Run {run.id.slice(0, 8)}</div>
            <div className='truncate text-xs text-secondary-foreground'>{run.targetApplicationId}</div>
          </div>
          <div className='flex items-center gap-2'>
            <Badge
              variant={displayStatus === 'failed' || displayStatus === 'canceled' ? 'destructive' : 'secondary'}
              className='capitalize'
            >
              {displayStatus}
            </Badge>
            {allowCancel && activeStatuses.has(run.status) ? (
              <Button
                type='button'
                variant='ghost'
                size='icon'
                aria-label='Cancel automation run'
                disabled={isCanceling}
                onClick={() => void cancel()}
              >
                <IconPlayerStop className='size-4' />
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div
        className={
          compact
            ? 'grid max-h-64 gap-1 overflow-auto pr-1 font-mono text-xs'
            : 'grid max-h-72 gap-2 overflow-auto pr-1 font-mono text-xs'
        }
      >
        {visibleEvents.length === 0 ? (
          <div className='text-secondary-foreground'>Waiting for events...</div>
        ) : (
          visibleEvents.map(event => (
            <div
              key={event.id}
              className={eventTone(event.type)}
            >
              <span className='text-muted-foreground'>{String(event.sequence).padStart(3, '0')}</span>{' '}
              <span>{eventLabel(event)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
