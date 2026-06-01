'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type PollingQueryKey = string | readonly unknown[] | null

interface PollingQueryCacheEntry<Data = unknown, Error = unknown> {
  data?: Data
  error?: Error
  isValidating: boolean
  listeners: Set<() => void>
  updatedAt: number
}

interface MutateOptions {
  revalidate?: boolean
}

interface UsePollingQueryOptions<Error = unknown> {
  enabled?: boolean
  intervalMs?: number | null
  onError?: (error: Error) => void
  revalidateOnMount?: boolean
}

const dedupingIntervalMs = 2000
const errorRetryIntervalMs = 2000
const errorRetryCount = 2
const focusThrottleIntervalMs = 5000
const cache = new Map<string, PollingQueryCacheEntry>()
const requests = new Map<string, Promise<unknown>>()
let lastFocusRefreshAt = 0

const serializeKey = (key: PollingQueryKey) => {
  if (!key) {
    return null
  }

  return typeof key === 'string' ? key : JSON.stringify(key)
}

const getCacheEntry = <Data, Error>(key: string) => {
  const existing = cache.get(key)
  if (existing) {
    return existing as PollingQueryCacheEntry<Data, Error>
  }

  const created: PollingQueryCacheEntry<Data, Error> = {
    isValidating: false,
    listeners: new Set(),
    updatedAt: 0
  }
  cache.set(key, created)
  return created
}

const notify = (entry: PollingQueryCacheEntry) => {
  entry.listeners.forEach(listener => listener())
}

const fetchQuery = async <Data, Error>(
  key: string,
  fetcher: () => Promise<Data>,
  onError?: (error: Error) => void,
  force = false
) => {
  const entry = getCacheEntry<Data, Error>(key)
  if (!force && entry.updatedAt > 0 && Date.now() - entry.updatedAt < dedupingIntervalMs) {
    return entry.data
  }

  const existing = requests.get(key)
  if (existing) {
    return existing as Promise<Data>
  }

  entry.isValidating = true
  notify(entry)
  const pending = fetcher()
    .then(data => {
      entry.data = data
      entry.error = undefined
      entry.updatedAt = Date.now()
      return data
    })
    .catch((error: Error) => {
      entry.error = error
      onError?.(error)
      throw error
    })
    .finally(() => {
      entry.isValidating = false
      requests.delete(key)
      notify(entry)
    })
  requests.set(key, pending)
  return pending
}

export const usePollingQuery = <Data, Error = unknown>(
  key: PollingQueryKey,
  fetcher: () => Promise<Data>,
  { enabled = true, intervalMs = null, onError, revalidateOnMount = true }: UsePollingQueryOptions<Error> = {}
) => {
  const serializedKey = useMemo(() => serializeKey(key), [key])
  const fetcherRef = useRef(fetcher)
  const onErrorRef = useRef(onError)
  const [, render] = useState(0)

  useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const run = useCallback(
    (force = false, overrideFetcher?: () => Promise<Data>) => {
      if (!enabled || !serializedKey) {
        return Promise.resolve(undefined)
      }

      return fetchQuery<Data, Error>(serializedKey, overrideFetcher ?? fetcherRef.current, onErrorRef.current, force)
    },
    [enabled, serializedKey]
  )

  const mutate = useCallback(
    async (overrideFetcher?: () => Promise<Data>, _options?: MutateOptions) => {
      return run(true, overrideFetcher)
    },
    [run]
  )

  useEffect(() => {
    if (!enabled || !serializedKey) {
      return
    }

    const entry = getCacheEntry<Data, Error>(serializedKey)
    const rerender = () => render(value => value + 1)
    const retryTimers = new Set<number>()
    entry.listeners.add(rerender)

    const isForeground = () =>
      document.visibilityState === 'visible' && (typeof navigator === 'undefined' || navigator.onLine !== false)

    const schedule = (attempt = 0) => {
      if (!isForeground()) {
        return
      }

      void run().catch(() => {
        if (attempt >= errorRetryCount) {
          return
        }

        const timer = window.setTimeout(
          () => {
            retryTimers.delete(timer)
            schedule(attempt + 1)
          },
          errorRetryIntervalMs * 2 ** attempt
        )
        retryTimers.add(timer)
      })
    }

    const refreshAfterFocus = () => {
      if (Date.now() - lastFocusRefreshAt < focusThrottleIntervalMs) {
        return
      }

      lastFocusRefreshAt = Date.now()
      schedule()
    }

    if (revalidateOnMount) {
      schedule()
    }

    const intervalId = intervalMs ? window.setInterval(() => schedule(), intervalMs) : null
    window.addEventListener('focus', refreshAfterFocus)
    window.addEventListener('online', refreshAfterFocus)
    document.addEventListener('visibilitychange', refreshAfterFocus)

    return () => {
      entry.listeners.delete(rerender)
      if (intervalId) {
        window.clearInterval(intervalId)
      }
      retryTimers.forEach(timer => window.clearTimeout(timer))
      window.removeEventListener('focus', refreshAfterFocus)
      window.removeEventListener('online', refreshAfterFocus)
      document.removeEventListener('visibilitychange', refreshAfterFocus)
    }
  }, [enabled, intervalMs, revalidateOnMount, run, serializedKey])

  const entry = serializedKey ? getCacheEntry<Data, Error>(serializedKey) : undefined
  return {
    data: entry?.data,
    error: entry?.error,
    isLoading: Boolean(enabled && serializedKey && entry?.data === undefined && entry?.error === undefined),
    isValidating: entry?.isValidating ?? false,
    mutate
  }
}
