'use client'

import { useEffect, useState } from 'react'
import { getResourceLimitBoundsAction } from '@/server/orchestrator/diagnostics/actions'
import type { ResourceLimitBounds } from '@/server/orchestrator/diagnostics/resource-limits'

export const useResourceLimitBounds = (enabled: boolean, initialValue: ResourceLimitBounds | null = null) => {
  const [resourceLimits, setResourceLimits] = useState<ResourceLimitBounds | null>(initialValue)

  useEffect(() => {
    if (!enabled) {
      return
    }

    let isCurrent = true

    void getResourceLimitBoundsAction()
      .then(nextLimits => {
        if (isCurrent) {
          setResourceLimits(nextLimits)
        }
      })
      .catch(() => {
        if (isCurrent) {
          setResourceLimits(null)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [enabled])

  return resourceLimits
}
