'use client'

import { useEffect, useState } from 'react'
import { ActionResultError } from '@/shared/actions/action-result'

export const usePickerOptions = <T>(open: boolean, read: (signal: AbortSignal) => Promise<T[]>) => {
  const [items, setItems] = useState<T[]>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setLoading(true)
    setError(undefined)
    void read(controller.signal)
      .then(nextItems => {
        if (!controller.signal.aborted) setItems(nextItems)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        if (
          cause instanceof ActionResultError &&
          (cause.failure.code === 'unauthenticated' || cause.failure.code === 'forbidden')
        ) {
          setItems(undefined)
        }
        setError(cause)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [attempt, open, read])

  return { items, loading, error, retry: () => setAttempt(previous => previous + 1) }
}
