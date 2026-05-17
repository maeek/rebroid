'use client'

import { startTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { recordViewerActivityAction } from '@/lib/orchestrator/actions'

const keepaliveIntervalMs = 30_000

export const ViewerActivityKeepalive = ({ applicationId }: { applicationId: string }) => {
  useEffect(() => {
    let cancelled = false

    const refreshActivity = async () => {
      try {
        await recordViewerActivityAction(applicationId)
      } catch {
        if (!cancelled) {
          window.clearInterval(interval)
        }
      }
    }

    const interval = window.setInterval(() => {
      void refreshActivity()
    }, keepaliveIntervalMs)

    void refreshActivity()

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [applicationId])

  return null
}

export const ViewerStartupRefresh = ({ deadlineAt, intervalMs }: { deadlineAt: string; intervalMs: number }) => {
  const router = useRouter()

  useEffect(() => {
    const deadlineMs = Date.parse(deadlineAt)
    if (Number.isNaN(deadlineMs)) {
      return
    }

    let intervalId = 0

    const refresh = () => {
      if (document.visibilityState !== 'visible') {
        return
      }

      if (Date.now() >= deadlineMs) {
        window.clearInterval(intervalId)
        return
      }

      startTransition(() => {
        router.refresh()
      })
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    const handleFocus = () => {
      refresh()
    }

    intervalId = window.setInterval(refresh, intervalMs)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [deadlineAt, intervalMs, router])

  return null
}
