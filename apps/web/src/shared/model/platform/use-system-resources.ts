'use client'

import { useCallback } from 'react'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { getSystemResourcesAction } from '@/server/orchestrator/diagnostics/actions'
import type { SystemResources } from '@/server/orchestrator/diagnostics/types'

const systemResourcesKey = 'orchestrator:system-resources'
const systemResourcesRefreshIntervalMs = 15_000

export const useSystemResources = () => {
  const { mutate, ...query } = usePollingQuery<SystemResources>(systemResourcesKey, getSystemResourcesAction, {
    intervalMs: systemResourcesRefreshIntervalMs
  })

  const refresh = useCallback(async () => {
    await mutate()
  }, [mutate])

  return { ...query, mutate, refresh }
}
