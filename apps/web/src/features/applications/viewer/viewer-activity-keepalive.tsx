'use client'

import { startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useVisibilityAwareInterval } from '@/hooks/use-visibility-aware-interval'
import { recordViewerActivityAction } from '@/server/orchestrator/applications/actions/runtime/viewer-actions'

const keepaliveIntervalMs = 30_000

export const ViewerActivityKeepalive = ({ applicationId }: { applicationId: string }) => {
  useVisibilityAwareInterval({
    immediate: true,
    intervalMs: keepaliveIntervalMs,
    stopOnError: true,
    task: async () => {
      await recordViewerActivityAction(applicationId)
    }
  })

  return null
}

export const ViewerStartupRefresh = ({ deadlineAt, intervalMs }: { deadlineAt: string; intervalMs: number }) => {
  const router = useRouter()
  const deadlineMs = Date.parse(deadlineAt)

  useVisibilityAwareInterval({
    enabled: !Number.isNaN(deadlineMs) && Date.now() < deadlineMs,
    intervalMs,
    task: () => {
      if (Date.now() < deadlineMs) {
        startTransition(() => {
          router.refresh()
        })
      }
    }
  })

  return null
}
