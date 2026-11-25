'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  actionDialogCopy,
  type ContainerPendingAction
} from '@/features/platform/details/runtime-container-detail/container-detail-utils'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import {
  removePlatformContainerAction,
  stopPlatformContainerAction
} from '@/server/orchestrator/platform/container-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import type { PlatformContainerSummary } from '@/shared/contracts/platform'

export const useContainerDetailController = (container: PlatformContainerSummary['container']) => {
  const router = useRouter()
  const [pendingAction, setPendingAction] = useState<ContainerPendingAction | null>(null)
  const [isActing, setIsActing] = useState(false)
  const [forceRemove, setForceRemove] = useState(container.state === 'removing')

  const runAction = async () => {
    if (!pendingAction) {
      return
    }

    const actionRunners: Record<ContainerPendingAction, () => Promise<void>> = {
      stop: async () => {
        unwrapActionResult(await stopPlatformContainerAction(container.id))
        toast({ title: 'Container stopped' })
        router.refresh()
      },
      remove: async () => {
        unwrapActionResult(await removePlatformContainerAction(container.id, forceRemove))
        toast({ title: forceRemove ? 'Container force-removed' : 'Container removed' })
        router.push('/runtime/containers')
      }
    }

    setIsActing(true)
    try {
      await actionRunners[pendingAction]()
      setPendingAction(null)
    } catch (error) {
      toast({
        title: actionDialogCopy[pendingAction].errorTitle,
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    } finally {
      setIsActing(false)
    }
  }

  const closeActionDialog = (open: boolean) => {
    if (!open) {
      setPendingAction(null)
    }
  }

  return { pendingAction, isActing, forceRemove, setForceRemove, setPendingAction, runAction, closeActionDialog }
}
