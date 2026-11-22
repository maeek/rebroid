'use client'

import { useEffect, useEffectEvent } from 'react'

interface UseVisibilityAwareIntervalOptions {
  enabled?: boolean
  immediate?: boolean
  intervalMs: number | null
  runOnFocus?: boolean
  stopOnError?: boolean
  task: (signal: AbortSignal) => Promise<void> | void
}

export const useVisibilityAwareInterval = ({
  enabled = true,
  immediate = false,
  intervalMs,
  runOnFocus = true,
  stopOnError = false,
  task
}: UseVisibilityAwareIntervalOptions) => {
  const runTask = useEffectEvent(task)

  useEffect(() => {
    if (!enabled || !intervalMs) return
    const controller = new AbortController()
    let running = false
    let intervalId: number | undefined

    const run = async () => {
      if (controller.signal.aborted || running || document.visibilityState !== 'visible') return
      running = true
      try {
        await runTask(controller.signal)
      } catch {
        if (stopOnError) {
          controller.abort()
          window.clearInterval(intervalId)
        }
      } finally {
        running = false
      }
    }

    const tick = () => void run()
    const schedule = () => {
      window.clearInterval(intervalId)
      if (!controller.signal.aborted && document.visibilityState === 'visible') {
        intervalId = window.setInterval(tick, intervalMs)
      }
    }

    const onVisibilityChange = () => {
      schedule()
      if (runOnFocus) void run()
    }
    schedule()
    if (immediate) void run()
    if (runOnFocus) window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      controller.abort()
      window.clearInterval(intervalId)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled, immediate, intervalMs, runOnFocus, stopOnError])
}
