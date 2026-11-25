'use client'

import { useCallback, useEffect, useEffectEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

type PollingQueryKey = string | readonly unknown[] | null

interface UsePollingQueryOptions<Error = unknown> {
  enabled?: boolean
  intervalMs?: number | null
  onError?: (error: Error) => void
  revalidateOnMount?: boolean
}

export const pollingQueryKey = (key: PollingQueryKey) => ['polling-query', key || null] as const

export const usePollingQuery = <Data, Error = unknown>(
  key: PollingQueryKey,
  fetcher: (context: { signal: AbortSignal }) => Promise<Data>,
  { enabled = true, intervalMs = null, onError, revalidateOnMount = true }: UsePollingQueryOptions<Error> = {}
) => {
  const queryClient = useQueryClient()
  const queryKey = pollingQueryKey(key)
  const active = enabled && Boolean(key)
  const reportError = useEffectEvent((error: Error) => onError?.(error))

  const query = useQuery<Data, Error>({
    queryKey,
    queryFn: fetcher,
    enabled: active,
    refetchInterval: intervalMs ?? false,
    refetchIntervalInBackground: false,
    refetchOnMount: revalidateOnMount ? 'always' : false
  })
  const { refetch } = query

  useEffect(() => {
    if (query.error !== null) {
      reportError(query.error)
    }
  }, [query.error])

  const mutate = useCallback(
    async (options?: { throwOnError?: boolean }) => {
      if (!active) return undefined
      return refetch({ cancelRefetch: false, throwOnError: options?.throwOnError }).then(result => result.data)
    },
    [active, refetch]
  )

  const replaceData = async (value: Data) => {
    if (!active) return
    await queryClient.cancelQueries({ queryKey, exact: true })
    queryClient.setQueryData<Data>(queryKey, () => value)
  }

  return {
    data: query.data,
    error: query.error ?? undefined,
    isLoading: query.isLoading,
    isValidating: query.isFetching,
    mutate,
    replaceData
  }
}
