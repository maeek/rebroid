'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { isActiveRunStatus, runStatusFromEvent } from '@/shared/model/automation-run-status'
import { subscribeToRunEvents } from '@/shared/model/run-event-delivery'
import type { AutomationRun, AutomationRunEvent, AutomationRunStatus } from '@/shared/contracts/automation'

export const useAutomationRunEvents = (run: Pick<AutomationRun, 'id' | 'status'>, enabled = true) => {
  const { id: runId, status: serverStatus } = run
  const [events, setEvents] = useState<AutomationRunEvent[]>([])
  const [state, setState] = useState({ runId, status: serverStatus })
  const [streamError, setStreamError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [hasLoadedEvents, setHasLoadedEvents] = useState(false)
  const statusRef = useRef(serverStatus)
  const cursor = useRef(0)
  const sameRun = state.runId === runId
  const status = sameRun && isActiveRunStatus(serverStatus) ? state.status : serverStatus
  const getServerStatus = useEffectEvent(() => serverStatus)

  useEffect(() => {
    const initialStatus = getServerStatus()
    cursor.current = 0
    statusRef.current = initialStatus
    setState({ runId, status: initialStatus })
    setEvents([])
    setHasLoadedEvents(false)
    setStreamError(null)
  }, [runId])

  useEffect(() => {
    if (serverStatus === 'queued' || !isActiveRunStatus(statusRef.current)) return
    statusRef.current = serverStatus
    setState({ runId, status: serverStatus })
  }, [runId, serverStatus])

  const applyEventStatus = useEffectEvent((next: AutomationRunStatus) => {
    if (next === 'queued' || next === statusRef.current || !isActiveRunStatus(statusRef.current)) return
    statusRef.current = next
    setState({ runId, status: next })
  })

  useEffect(() => {
    setConnected(false)
    if (!enabled) return
    return subscribeToRunEvents({
      runId,
      after: cursor.current,
      isLive: () => isActiveRunStatus(statusRef.current),
      onEvents: nextEvents => {
        cursor.current = nextEvents[nextEvents.length - 1].sequence
        setEvents(current => current.concat(nextEvents))
        for (const event of nextEvents) {
          const next = runStatusFromEvent(event)
          if (next) applyEventStatus(next)
        }
      },
      onReady: () => {
        setStreamError(null)
        setHasLoadedEvents(true)
      },
      onConnected: () => setConnected(true),
      onDisconnect: () => {
        setConnected(false)
        setStreamError('Reconnecting to live updates…')
      },
      onError: reason => {
        setConnected(false)
        if (reason === 'invalid-event') setStreamError('A live event could not be read.')
        else
          setStreamError(
            isActiveRunStatus(statusRef.current)
              ? 'Live updates are temporarily unavailable.'
              : 'Could not load recorded events.'
          )
      }
    })
  }, [enabled, runId])

  return {
    status,
    events: sameRun ? events : [],
    streamError: sameRun ? streamError : null,
    hasLoadedEvents: sameRun && hasLoadedEvents,
    connected: sameRun && isActiveRunStatus(status) && connected
  }
}
