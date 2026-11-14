'use client'

import { useQuery } from '@tanstack/react-query'
import { getBff } from '@/lib/http/bff'
import type { ApplicationRuntimeSnapshot } from '@/shared/contracts/application'

const refreshIntervalMs = 60_000

export const useApplicationSnapshot = (appId: string) => {
  const { data, isError, isPending } = useQuery({
    queryKey: ['applications', 'runtime-snapshot', appId],
    queryFn: ({ signal }) =>
      getBff<ApplicationRuntimeSnapshot>(`/api/bff/applications/${encodeURIComponent(appId)}/runtime/snapshot`, signal),
    gcTime: 0,
    staleTime: refreshIntervalMs,
    refetchInterval: refreshIntervalMs,
    retry: false
  })

  return { snapshot: isError ? undefined : data, pending: isPending }
}
