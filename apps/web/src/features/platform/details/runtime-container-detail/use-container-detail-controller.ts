'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  actionDialogCopy,
  containerStatsRefreshIntervalMs,
  type ContainerPendingAction
} from '@/features/platform/details/runtime-container-detail/container-detail-utils'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import {
  getPlatformContainerStatsAction,
  removePlatformContainerAction,
  stopPlatformContainerAction
} from '@/server/orchestrator/platform/container-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import type { PlatformContainerDetails, PlatformContainerStats } from '@/shared/contracts/platform'

const useContainerStats = (container: PlatformContainerDetails['container']) => {
  const {
    data: stats,
    error: caughtStatsError,
    isValidating: isRefreshingStats,
    mutate: refreshStats
  } = usePollingQuery<PlatformContainerStats>(
    ['orchestrator', 'containers', container.id, 'stats'],
    () => getPlatformContainerStatsAction(container.id),
    {
      enabled: container.state === 'running',
      intervalMs: containerStatsRefreshIntervalMs
    }
  )
  const statsError = caughtStatsError
    ? getDisplayErrorMessage(caughtStatsError, 'Could not collect live container stats.')
    : null

  return { stats, statsError, isRefreshingStats, refreshStats }
}

const useContainerActions = (container: PlatformContainerDetails['container']) => {
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

export const useContainerDetailController = ({ container }: { container: PlatformContainerDetails['container'] }) => {
  const stats = useContainerStats(container)
  const actions = useContainerActions(container)

  return { ...stats, ...actions }
}
