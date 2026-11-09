'use client'

import { useEffect, useState } from 'react'
import { getBff } from '@/lib/http/bff'
import { ActionResultError } from '@/shared/actions/action-result'
import { PlatformOperationsContent } from './platform-operations-content'
import type { PlatformOperationsSnapshot } from '@/shared/contracts/platform-operations'

export const PlatformOperationsSection = ({
  refreshKey = 0,
  onRefreshComplete
}: {
  refreshKey?: number
  onRefreshComplete?: () => void
}) => {
  const [snapshot, setSnapshot] = useState<PlatformOperationsSnapshot | null>(null)
  const [error, setError] = useState(false)
  const [requestId, setRequestId] = useState<string>()
  useEffect(() => {
    let active = true
    void getBff<PlatformOperationsSnapshot>('/api/bff/platform/operations')
      .then(nextSnapshot => {
        if (active) {
          setSnapshot(nextSnapshot)
          setError(false)
          setRequestId(undefined)
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(true)
          setRequestId(
            caught instanceof ActionResultError && caught.failure.requestId !== 'local'
              ? caught.failure.requestId
              : undefined
          )
        }
      })
      .finally(() => {
        if (active && refreshKey > 0) onRefreshComplete?.()
      })
    return () => {
      active = false
    }
  }, [refreshKey, onRefreshComplete])
  return (
    <PlatformOperationsContent
      snapshot={snapshot}
      error={error}
      requestId={requestId}
    />
  )
}
