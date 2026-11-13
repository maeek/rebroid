'use client'

import { useCallback, useEffect, useState } from 'react'

/** Confirm successful writes with a stable draft key, e.g. a serialized form, so revalidation does not clear feedback. */
export const useSaveFeedback = <Draft>(draft: Draft) => {
  const [confirmation, setConfirmation] = useState<{ draft: Draft } | null>(null)
  if (confirmation && !Object.is(confirmation.draft, draft)) setConfirmation(null)

  useEffect(() => {
    if (!confirmation) return
    const timer = window.setTimeout(() => setConfirmation(null), 1200)
    return () => window.clearTimeout(timer)
  }, [confirmation])

  const confirmSaved = useCallback((savedDraft: Draft) => setConfirmation({ draft: savedDraft }), [])
  const resetSaveFeedback = useCallback(() => setConfirmation(null), [])

  return { saved: confirmation !== null, confirmSaved, resetSaveFeedback }
}
