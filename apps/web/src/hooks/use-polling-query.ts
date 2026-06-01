'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

type PollingQueryKey = string | readonly unknown[] | null

interface MutateOptions {
  revalidate?: boolean
}

interface UsePollingQueryOptions<Error = unknown> {
  enabled?: boolean
  intervalMs?: number | null
  onError?: (error: Error) => void
  revalidateOnMount?: boolean
}

const serializeKey = (key: PollingQueryKey) => {
  if (!key) {
    return null
  }

  return typeof key === 'string' ? key : JSON.stringify(key)
}

export const usePollingQuery = <Data, Error = unknown>(
  key: PollingQueryKey,
  fetcher: () => Promise<Data>,
  { enabled = true, intervalMs = null, onError, revalidateOnMount = true }: UsePollingQueryOptions<Error> = {}
) => {
  const queryClient = useQueryClient()
  const serializedKey = useMemo(() => serializeKey(key), [key])
  const queryKey = useMemo(() => ['polling-query', serializedKey ?? 'disabled'] as const, [serializedKey])
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const query = useQuery<Data, Error>({
    queryKey,
    queryFn: fetcher,
    enabled: enabled && serializedKey !== null,
    refetchInterval: intervalMs ?? false,
    refetchIntervalInBackground: false,
    refetchOnMount: revalidateOnMount ? 'always' : false
  })

  useEffect(() => {
    if (query.error !== null) {
      onErrorRef.current?.(query.error)
    }
  }, [query.error])

  const mutate = useCallback(
    async (overrideFetcher?: () => Promise<Data>, options?: MutateOptions) => {
      if (!enabled || serializedKey === null) {
        return undefined
      }
      if (options?.revalidate === false) {
        return queryClient.getQueryData<Data>(queryKey)
      }
      if (overrideFetcher) {
        return queryClient.fetchQuery({ queryKey, queryFn: overrideFetcher, staleTime: 0 })
      }

      return query.refetch().then(result => result.data)
    },
    [enabled, query, queryClient, queryKey, serializedKey]
  )

  return {
    data: query.data,
    error: query.error ?? undefined,
    isLoading: query.isLoading,
    isValidating: query.isFetching,
    mutate
  }
}
