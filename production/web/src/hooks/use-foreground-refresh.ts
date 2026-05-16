'use client'

import { useEffect, useRef } from 'react'

interface UseForegroundRefreshOptions {
  enabled?: boolean
  intervalMs: number | null
  refresh: () => Promise<void> | void
}

export function useForegroundRefresh({ enabled = true, intervalMs, refresh }: UseForegroundRefreshOptions) {
  const refreshRef = useRef(refresh)

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  useEffect(() => {
    if (!enabled || !intervalMs) {
      return
    }

    let isDisposed = false

    const runRefresh = () => {
      if (isDisposed || document.visibilityState !== 'visible') {
        return
      }

      void Promise.resolve(refreshRef.current()).catch(() => undefined)
    }

    const intervalId = window.setInterval(runRefresh, intervalMs)

    const handleWindowFocus = () => {
      runRefresh()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runRefresh()
      }
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isDisposed = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, intervalMs])
}
