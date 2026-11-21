'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { subscribeToRunEvents } from '@/shared/model/run-event-delivery'
import type { AutomationRun, AutomationRunEvent, AutomationRunStatus } from '@/shared/contracts/automation'

export const activeRunStatuses = new Set<AutomationRunStatus>(['queued', 'running'])

const statusFromEvent = (event: AutomationRunEvent): AutomationRunStatus | null => {
  if (event.type === 'run.started') return 'running'
  if (event.type === 'run.completed') return 'success'
  if (event.type === 'run.failed') return 'failed'
  if (event.type === 'run.canceled') return 'canceled'
  return null
}

export const useAutomationRunEvents = (
  run: Pick<AutomationRun, 'id' | 'status'>,
  enabled = true,
  onStatusChange?: (status: AutomationRunStatus) => void
) => {
  const { id: runId, status: serverStatus } = run
  const [events, setEvents] = useState<AutomationRunEvent[]>([])
  const [state, setState] = useState({ runId, status: serverStatus })
  const [streamError, setStreamError] = useState<string | null>(null)
  const [hasLoadedEvents, setHasLoadedEvents] = useState(false)
  const statusRef = useRef(serverStatus)
  const status = state.runId === runId && activeRunStatuses.has(serverStatus) ? state.status : serverStatus
  const getServerStatus = useEffectEvent(() => serverStatus)

  useEffect(() => {
    const initialStatus = getServerStatus()
    statusRef.current = initialStatus
    setState({ runId, status: initialStatus })
    setEvents([])
    setHasLoadedEvents(false)
    setStreamError(null)
  }, [runId])

  useEffect(() => {
    if (serverStatus === 'queued' || !activeRunStatuses.has(statusRef.current)) return
    statusRef.current = serverStatus
    setState({ runId, status: serverStatus })
  }, [runId, serverStatus])

  const applyStatus = (next: AutomationRunStatus) => {
    if (next === 'queued' || next === statusRef.current || !activeRunStatuses.has(statusRef.current)) return
    statusRef.current = next
    setState({ runId, status: next })
    onStatusChange?.(next)
  }
  const applyEventStatus = useEffectEvent(applyStatus)

  useEffect(() => {
    if (!enabled) return
    return subscribeToRunEvents({
      runId,
      isLive: () => activeRunStatuses.has(statusRef.current),
      onEvents: nextEvents => {
        setEvents(current => {
          const byId = new Map(current.map(event => [event.id, event]))
          for (const event of nextEvents) byId.set(event.id, event)
          return [...byId.values()].sort((left, right) => left.sequence - right.sequence)
        })
        for (const event of nextEvents) {
          const next = statusFromEvent(event)
          if (next) applyEventStatus(next)
        }
      },
      onReady: () => {
        setStreamError(null)
        setHasLoadedEvents(true)
      },
      onDisconnect: () => setStreamError('Reconnecting to live updates…'),
      onError: reason => {
        if (reason === 'invalid-event') setStreamError('A live event could not be read.')
        else
          setStreamError(
            activeRunStatuses.has(statusRef.current)
              ? 'Live updates are temporarily unavailable.'
              : 'Could not load recorded events.'
          )
      }
    })
  }, [enabled, runId])

  return { status, events, streamError, hasLoadedEvents, applyStatus }
}
