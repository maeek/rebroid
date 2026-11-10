'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

export const useCreateDialog = (disabled: boolean) => {
  const params = useSearchParams()
  const shortcutOpen = params?.get('create') === '1'
  const [localOpen, setLocalOpen] = useState(false)

  const setOpen = (open: boolean) => {
    setLocalOpen(open)
    if (!open && shortcutOpen) {
      const url = new URL(window.location.href)
      url.searchParams.delete('create')
      window.history.replaceState(null, '', url)
    }
  }

  return { open: !disabled && (localOpen || shortcutOpen), setOpen }
}
