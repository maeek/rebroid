'use client'

import { useEffect, useState } from 'react'

export const useDialogPayload = <T>(value: T | null) => {
  const [retained, setRetained] = useState(value)

  useEffect(() => {
    if (value !== null) setRetained(value)
  }, [value])

  return {
    payload: value ?? retained,
    onOpenChangeComplete: (open: boolean) => {
      if (!open) setRetained(null)
    }
  }
}
