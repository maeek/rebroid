'use client'

import { useCallback, useEffect, useState } from 'react'

/** Call confirm only after the owning operation has acknowledged success. */
export const useConfirmedFeedback = <Value>() => {
  const [receipt, setReceipt] = useState<{ value: Value } | null>(null)
  useEffect(() => {
    if (!receipt) return
    const timeout = window.setTimeout(() => setReceipt(null), 1200)
    return () => window.clearTimeout(timeout)
  }, [receipt])
  const confirm = useCallback((value: Value) => setReceipt({ value }), [])
  const reset = useCallback(() => setReceipt(null), [])
  return { confirmation: receipt?.value ?? null, confirm, reset }
}
