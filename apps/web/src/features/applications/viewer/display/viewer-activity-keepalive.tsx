'use client'

import { startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useVisibilityAwareInterval } from '@/hooks/use-visibility-aware-interval'
import { recordViewerActivityAction } from '@/server/orchestrator/applications/actions/runtime/viewer-actions'

const keepaliveIntervalMs = 30_000

export const ViewerActivityKeepalive = ({
  applicationId,
  runtimeKey
}: {
  applicationId: string
  runtimeKey?: string
}) =>
  runtimeKey ? (
    <ViewerActivityTimer
      key={runtimeKey}
      applicationId={applicationId}
      runtimeKey={runtimeKey}
    />
  ) : null

const ViewerActivityTimer = ({ applicationId, runtimeKey }: { applicationId: string; runtimeKey: string }) => {
  useVisibilityAwareInterval({
    immediate: true,
    intervalMs: keepaliveIntervalMs,
    stopOnError: true,
    task: async () => {
      const result = await recordViewerActivityAction(applicationId, runtimeKey).catch(() => null)
      if (result && !result.ok && result.error.status && result.error.status < 500 && result.error.status !== 429) {
        throw new Error(result.error.message)
      }
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
