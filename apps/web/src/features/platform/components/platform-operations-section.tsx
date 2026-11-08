'use client'

import { useEffect, useState } from 'react'
import { getBff } from '@/lib/http/bff'
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
  useEffect(() => {
    let active = true
    void getBff<PlatformOperationsSnapshot>('/api/bff/platform/operations')
      .then(nextSnapshot => {
        if (active) {
          setSnapshot(nextSnapshot)
          setError(false)
        }
      })
      .catch(() => {
        if (active) setError(true)
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
    />
  )
}
