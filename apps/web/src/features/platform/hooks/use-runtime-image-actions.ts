'use client'

import { useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { removePlatformImageAction } from '@/server/orchestrator/platform/image-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { successfulBulkIds } from '@/shared/actions/bulk-action-results'
import { summarizePlatformBulkRemoveResults } from '../components/runtime-grid-query-utils'
import type { PlatformImage } from '@/shared/contracts/platform'

export const useRuntimeImageActions = ({
  deselectItems,
  refresh
}: {
  deselectItems: (ids: ReadonlySet<string>) => void
  refresh: () => void
}) => {
  const [pendingRemove, setPendingRemove] = useState<PlatformImage[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const removeImages = async () => {
    if (busyId || !pendingRemove?.length) return

    setBusyId(pendingRemove.length === 1 ? pendingRemove[0].id : 'bulk')
    try {
      const results = await Promise.allSettled(pendingRemove.map(image => removePlatformImageAction(image.id)))
      if (pendingRemove.length === 1) {
        const result = results[0]
        if (result.status === 'rejected') throw result.reason
        unwrapActionResult(result.value)
        toast({ title: 'Image removed', variant: 'success' })
      } else {
        toast(summarizePlatformBulkRemoveResults(results, 'image'))
      }
      deselectItems(successfulBulkIds(pendingRemove, results))
      setPendingRemove(null)
      refresh()
    } catch (caughtError) {
      toast({
        title: 'Could not remove image',
        description: getDisplayErrorMessage(caughtError),
        variant: 'danger'
      })
    } finally {
      setBusyId(null)
    }
  }

  return { pendingRemove, setPendingRemove, busyId, removeImages }
}
