import { useCallback, useEffect, useRef, useState } from 'react'
import { useVisibilityAwareInterval } from '@/hooks/use-visibility-aware-interval'
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
  run: Pick<AutomationRun, 'id' | 'status'>,
  enabled: boolean,
  refresh: () => Promise<unknown>
) => {
  const feed = useAutomationRunEvents(run, enabled)
  const active = enabled && activeRunStatuses.has(run.status)
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
    const current = { runId: run.id, pending: false, repeat: false } satisfies RefreshQueue
    queue.current = current
    return () => {
      clearTimeout(queue.current?.timer)
      queue.current = undefined
    }
  }, [run.id, active])

  const sequence = feed.events.findLast(event => event.runId === run.id && refreshEvents.has(event.type))?.sequence
  useEffect(() => {
    if (active && sequence !== undefined) enqueue()
  }, [active, enqueue, sequence])

  useVisibilityAwareInterval({
    enabled: active && (!feed.connected || !activeRunStatuses.has(feed.status) || failedRunId === run.id),
    intervalMs: 5_000,
    runOnFocus: false,
    task: () => enqueue()
  })

  return feed
}
