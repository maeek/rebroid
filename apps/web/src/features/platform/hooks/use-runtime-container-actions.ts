'use client'

import { useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import {
  removePlatformContainerAction,
  stopPlatformContainerAction
} from '@/server/orchestrator/platform/container-actions'
import { actionOk, unwrapActionResult } from '@/shared/actions/action-result'
import {
  canRunBulkContainerAction,
  shouldStopContainerInBulkAction,
  summarizeContainerBulkActionResults,
  type ContainerBulkActionType
} from '../components/runtime-containers-section-model'
import type { PlatformContainer } from '@/shared/contracts/platform'

type PendingContainerAction = { type: 'stop' | 'remove'; container: PlatformContainer } | null

export const useRuntimeContainerActions = ({
  selectedContainers,
  clearSelection,
  refresh
}: {
  selectedContainers: PlatformContainer[]
  clearSelection: () => void
  refresh: () => void
}) => {
  const [pendingAction, setPendingAction] = useState<PendingContainerAction>(null)
  const [pendingBulkAction, setPendingBulkAction] = useState<ContainerBulkActionType | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const runContainerAction = async () => {
    if (!pendingAction) return

    setBusyId(pendingAction.container.id)
    try {
      if (pendingAction.type === 'stop') {
        unwrapActionResult(await stopPlatformContainerAction(pendingAction.container.id))
        toast({ title: 'Container stopped', variant: 'success' })
      } else {
        unwrapActionResult(await removePlatformContainerAction(pendingAction.container.id))
        toast({ title: 'Container removed', variant: 'success' })
      }
      setPendingAction(null)
      refresh()
    } catch (caughtError) {
      toast({
        title: pendingAction.type === 'stop' ? 'Could not stop container' : 'Could not remove container',
        description: getDisplayErrorMessage(caughtError),
        variant: 'danger'
      })
    } finally {
      setBusyId(null)
    }
  }

  const runBulkAction = async (type: ContainerBulkActionType) => {
    if (!canRunBulkContainerAction(selectedContainers)) return

    setBusyId('bulk')
    try {
      const results = await Promise.all(
        selectedContainers.map(async container => {
          if (type === 'stop' && shouldStopContainerInBulkAction(container)) {
            return stopPlatformContainerAction(container.id)
          }
          if (type === 'remove') {
            return removePlatformContainerAction(container.id)
          }
          return actionOk(undefined)
        })
      )
      clearSelection()
      setPendingBulkAction(null)
      refresh()
      toast(summarizeContainerBulkActionResults(results, type))
    } finally {
      setBusyId(null)
    }
  }

  return {
    pendingAction,
    setPendingAction,
    pendingBulkAction,
    setPendingBulkAction,
    busyId,
    runContainerAction,
    runBulkAction
  }
}
