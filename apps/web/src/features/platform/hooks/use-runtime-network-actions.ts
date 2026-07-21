'use client'

import { useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { removePlatformNetworkAction } from '@/server/orchestrator/platform/network-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { summarizeNetworkRemoveResults } from '../components/runtime-networks-section-model'
import type { PlatformNetwork } from '@/shared/contracts/platform'

export const useRuntimeNetworkActions = ({
  clearSelection,
  refresh
}: {
  clearSelection: () => void
  refresh: () => void
}) => {
  const [pendingRemove, setPendingRemove] = useState<PlatformNetwork[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const removeNetworks = async () => {
    if (!pendingRemove?.length) return

    setBusyId(pendingRemove.length === 1 ? pendingRemove[0].id : 'bulk')
    try {
      const results = await Promise.all(pendingRemove.map(network => removePlatformNetworkAction(network.id)))
      if (pendingRemove.length === 1) {
        unwrapActionResult(results[0])
        toast({ title: 'Network removed', variant: 'success' })
      } else {
        toast(summarizeNetworkRemoveResults(results))
        clearSelection()
      }
      setPendingRemove(null)
      refresh()
    } catch (caughtError) {
      toast({
        title: 'Could not remove network',
        description: getDisplayErrorMessage(caughtError),
        variant: 'danger'
      })
    } finally {
      setBusyId(null)
    }
  }

  return { pendingRemove, setPendingRemove, busyId, removeNetworks }
}
