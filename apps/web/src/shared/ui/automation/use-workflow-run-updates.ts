import { useCallback, useEffect, useRef, useState } from 'react'
import { useVisibilityAwareInterval } from '@/hooks/use-visibility-aware-interval'
import { sendBff } from '@/lib/http/bff'
import { activeRunStatuses, useAutomationRunEvents } from './use-automation-run-events'
import type { AutomationRun, AutomationRunEventType } from '@/shared/contracts/automation'

const refreshEvents = new Set<AutomationRunEventType>([
  'run.started',
  'run.completed',
  'run.failed',
  'run.canceled',
  'step.completed',
  'step.failed'
])

type RefreshQueue = {
  runId: string
  timer?: ReturnType<typeof setTimeout>
  pending: boolean
  repeat: boolean
}

export const useWorkflowRunUpdates = (
  run: Pick<AutomationRun, 'id' | 'status'> | undefined,
  showEvents: boolean,
  refresh: () => Promise<unknown>
) => {
  const runId = run?.id ?? ''
  const active = !!run && activeRunStatuses.has(run.status)
  const feed = useAutomationRunEvents(run ?? { id: runId, status: 'queued' }, !!run && (active || showEvents))
  const [cancellation, setCancellation] = useState<{ runId: string; error?: Error }>()
  const canStop = !!run && activeRunStatuses.has(feed.status)
  const currentCancellation = cancellation?.runId === runId ? cancellation : undefined
  const [failedRunId, setFailedRunId] = useState<string>()
  const queue = useRef<RefreshQueue | undefined>(undefined)
  const readRun = useRef(refresh)
  useEffect(() => {
    readRun.current = refresh
  }, [refresh])
  const enqueue = useCallback(() => {
    const current = queue.current
    if (!current) return
    if (current.pending) {
      current.repeat = true
      return
    }
    if (current.timer) return
    const schedule = () => {
      current.timer = setTimeout(() => {
        current.timer = undefined
        current.pending = true
        const finish = (failed: boolean) => {
          current.pending = false
          if (queue.current !== current) return
          setFailedRunId(failed ? current.runId : undefined)
          if (current.repeat) {
            current.repeat = false
            schedule()
          }
        }
        void readRun.current().then(
          () => finish(false),
          () => finish(true)
        )
      }, 150)
    }
    schedule()
  }, [])

  useEffect(() => {
    const current = { runId, pending: false, repeat: false } satisfies RefreshQueue
    queue.current = current
    setCancellation(undefined)
    return () => {
      clearTimeout(queue.current?.timer)
      queue.current = undefined
    }
  }, [runId, active])

  const sequence = feed.events.findLast(event => event.runId === runId && refreshEvents.has(event.type))?.sequence
  useEffect(() => {
    if (active && sequence !== undefined) enqueue()
  }, [active, enqueue, sequence])

  useVisibilityAwareInterval({
    enabled: active && (!feed.connected || !activeRunStatuses.has(feed.status) || failedRunId === runId),
    intervalMs: 5_000,
    runOnFocus: false,
    task: () => enqueue()
  })

  const stopping = canStop && !!currentCancellation && !currentCancellation.error
  const stop = async () => {
    if (!canStop || stopping) return
    const current = queue.current
    setCancellation({ runId })
    try {
      await sendBff(`/api/bff/automations/runs/${encodeURIComponent(runId)}/cancel`, {})
    } catch (error) {
      if (queue.current === current) {
        setCancellation({ runId, error: error instanceof Error ? error : new Error('Could not stop workflow run') })
      }
      return
    }
    if (queue.current === current) {
      await refresh().catch(() => {
        if (queue.current === current) setFailedRunId(runId)
      })
    }
  }

  return { feed, active: canStop, stopping, stop, stopError: currentCancellation?.error }
}
