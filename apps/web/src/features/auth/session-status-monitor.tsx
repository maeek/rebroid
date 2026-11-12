'use client'

import { useEffect } from 'react'

const sessionCheckIntervalMs = 15_000

export const SessionStatusMonitor = () => {
  useEffect(() => {
    let request: AbortController | undefined

    const check = async () => {
      if (document.visibilityState !== 'visible' || request) return
      const controller = new AbortController()
      request = controller
      const timeout = window.setTimeout(() => controller.abort(), 5_000)
      try {
        const response = await fetch('/api/auth/session-status', {
          cache: 'no-store',
          signal: controller.signal
        })
        if (response.status === 401 && !controller.signal.aborted) window.location.replace('/login')
      } catch {
        // Retry a network failure at the next check.
      } finally {
        window.clearTimeout(timeout)
        request = undefined
      }
    }

    const refresh = () => void check()
    const interval = window.setInterval(refresh, sessionCheckIntervalMs)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      request?.abort()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return null
}
