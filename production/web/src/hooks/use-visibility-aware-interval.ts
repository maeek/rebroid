'use client'

import { useEffect, useRef } from 'react'

interface UseVisibilityAwareIntervalOptions {
  enabled?: boolean
  immediate?: boolean
  intervalMs: number | null
  runOnFocus?: boolean
  stopOnError?: boolean
  task: () => Promise<void> | void
}

export const useVisibilityAwareInterval = ({
  enabled = true,
  immediate = false,
  intervalMs,
  runOnFocus = true,
  stopOnError = false,
  task
}: UseVisibilityAwareIntervalOptions) => {
  const taskRef = useRef(task)

  useEffect(() => {
    taskRef.current = task
  }, [task])

  useEffect(() => {
    if (!enabled || !intervalMs) {
      return
    }

    let disposed = false
    let stopped = false
    let running = false

    const run = async () => {
      if (disposed || stopped || running || document.visibilityState !== 'visible') {
        return
      }

      running = true
      try {
        await taskRef.current()
      } catch {
        if (stopOnError) {
          stopped = true
        }
      } finally {
        running = false
      }
    }

    const runVisible = () => {
      void run()
    }

    if (immediate) {
      runVisible()
    }

    const intervalId = window.setInterval(runVisible, intervalMs)
    if (runOnFocus) {
      window.addEventListener('focus', runVisible)
      document.addEventListener('visibilitychange', runVisible)
    }

    return () => {
      disposed = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', runVisible)
      document.removeEventListener('visibilitychange', runVisible)
    }
  }, [enabled, immediate, intervalMs, runOnFocus, stopOnError])
}
