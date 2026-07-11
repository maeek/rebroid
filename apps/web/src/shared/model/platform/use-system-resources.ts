'use client'

import { useCallback } from 'react'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { getBff } from '@/lib/http/bff'
import type { SystemResources } from '@/shared/contracts/system-resources'

const systemResourcesKey = 'orchestrator:system-resources'
const systemResourcesRefreshIntervalMs = 15_000

export const useSystemResources = () => {
  const { mutate, ...query } = usePollingQuery<SystemResources>(
    systemResourcesKey,
    () => getBff('/api/bff/platform/resources'),
    {
      intervalMs: systemResourcesRefreshIntervalMs
    }
  )

  const refresh = useCallback(async () => {
    await mutate()
  }, [mutate])

  return { ...query, mutate, refresh }
}
