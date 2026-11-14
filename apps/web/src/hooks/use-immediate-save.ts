'use client'

import { useCallback, useRef, useState } from 'react'
import { useConfirmedFeedback } from './use-confirmed-feedback'

export const useImmediateSave = () => {
  const active = useRef(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const { confirmation: savedId, confirm, reset } = useConfirmedFeedback<string>()
  const save = useCallback(
    async (id: string, commit: () => Promise<void>) => {
      if (active.current) return
      active.current = true
      reset()
      setPendingId(id)
      try {
        await commit()
        confirm(id)
      } finally {
        active.current = false
        setPendingId(null)
      }
    },
    [confirm, reset]
  )
  return { pendingId, savedId, save }
}
