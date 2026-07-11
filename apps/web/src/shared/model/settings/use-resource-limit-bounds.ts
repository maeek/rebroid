'use client'

import { useEffect, useState } from 'react'
import { getBff } from '@/lib/http/bff'
import type { ResourceLimitBounds } from '@/shared/contracts/system-resources'

export const useResourceLimitBounds = (enabled: boolean, initialValue: ResourceLimitBounds | null = null) => {
  const [resourceLimits, setResourceLimits] = useState<ResourceLimitBounds | null>(initialValue)

  useEffect(() => {
    if (!enabled) {
      return
    }

    let isCurrent = true

    const controller = new AbortController()
    void getBff<ResourceLimitBounds>('/api/bff/platform/resource-limits', controller.signal)
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
      controller.abort()
    }
  }, [enabled])

  return resourceLimits
}
