import { useEffect, useMemo, useRef, useState } from 'react'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { sortApps, type AppsListSortMode } from '@/features/applications/domain/app-sort'
import { getAppsRefreshIntervalMs } from '@/features/applications/domain/refresh'
import {
  optimisticRemovingApp,
  optimisticStartingApp,
  optimisticStoppingApp
} from '@/features/applications/list/model/apps-list-optimistic-state'
import {
  mergeAppsListRefresh,
  type AppsListRefreshOverride
} from '@/features/applications/list/model/apps-list-refresh'
import {
  deriveAppsListSelection,
  fulfilledBulkDeleteAppIds,
  retainVisibleSelectedIds,
  summarizeBulkDeleteAppsResult,
  summarizeBulkStopAppsResult
} from '@/features/applications/list/model/apps-list-selection'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { removeAppIconAction } from '@/server/app-icons/actions/remove-app-icon-action'
import {
  deleteApplicationAction,
  startApplicationAction,
  stopApplicationAction
} from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { forgetRecentAppAction } from '@/server/recent-apps/actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { notifyRecentAppsUpdated } from '@/shared/model/recent-apps/recent-apps'
import { useOrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import type { AppsListContextValue, BulkAction, PendingAppAction } from './apps-list-context'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'
import type { OrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'

const listApplications = async () => {
  const response = await fetch('/api/applications', { cache: 'no-store' })
  if (!response.ok) {
    throw new Error('Could not refresh applications.')
  }

  return response.json() as Promise<AndroidApplication[]>
}

export const useAppsListController = ({
  currentOwnerUserId,
  yourApps,
  initialSettings
}: {
  currentOwnerUserId: string
  yourApps: AppDefinition[]
  initialSettings: OrchestratorUiSettings
}) => {
  const stoppingOverrideTimeoutMs = 60_000
  const [apps, setApps] = useState(yourApps)
  const [isManaging, setIsManaging] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [sortMode, setSortMode] = useState<AppsListSortMode>('name-asc')
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null)
  const [pendingAppAction, setPendingAppAction] = useState<PendingAppAction | null>(null)
  const [isBulkWorking, setIsBulkWorking] = useState(false)
  const pendingRefreshOverridesRef = useRef<Map<string, AppsListRefreshOverride>>(new Map())
  const hiddenRemovingIdsRef = useRef<Set<string>>(new Set())
  const settings = useOrchestratorUiSettings(initialSettings, { refreshOnMount: false })
  const refreshIntervalMs = getAppsRefreshIntervalMs(apps, settings.appListRefreshIntervalSeconds * 1000)

  useEffect(() => {
    setApps(yourApps)
  }, [yourApps])

  useEffect(() => {
    setSelectedIds(current => retainVisibleSelectedIds(apps, current))

    if (apps.length === 0) {
      setIsManaging(false)
    }
  }, [apps])

  const { data: refreshedApps } = usePollingQuery(
    ['applications', 'list', currentOwnerUserId],
    () => listApplications(),
    { intervalMs: refreshIntervalMs }
  )

  useEffect(() => {
    if (!refreshedApps) {
      return
    }

    setApps(current => {
      const { apps: nextApps, expiredOverrideIds } = mergeAppsListRefresh({
        currentApps: current,
        refreshedApps: refreshedApps.map(mapAndroidApplicationToAppDefinition),
        hiddenRemovingIds: hiddenRemovingIdsRef.current,
        pendingOverrides: pendingRefreshOverridesRef.current,
        nowMs: Date.now()
      })

      expiredOverrideIds.forEach(id => pendingRefreshOverridesRef.current.delete(id))

      return nextApps
    })
  }, [refreshedApps])

  const updateApp = (updatedApp: AppDefinition, preserveDuringRefresh = false) => {
    if (preserveDuringRefresh) {
      pendingRefreshOverridesRef.current.set(updatedApp.id, {
        app: updatedApp,
        expiresAt: updatedApp.lifecycleStage === 'stopping' ? Date.now() + stoppingOverrideTimeoutMs : null
      })
    } else {
      pendingRefreshOverridesRef.current.delete(updatedApp.id)
    }

    setApps(current => current.map(app => (app.id === updatedApp.id ? updatedApp : app)))
  }

  const removeApp = (appId: string) => {
    pendingRefreshOverridesRef.current.delete(appId)
    hiddenRemovingIdsRef.current.add(appId)
    setApps(current => current.filter(item => item.id !== appId))
  }

  const startApp = async (app: AppDefinition) => {
    try {
      updateApp(optimisticStartingApp(app), true)
      const updated = await startApplicationAction(app.id)
      updateApp(mapAndroidApplicationToAppDefinition(updated))
    } catch (error) {
      updateApp(app)
      toast({
        title: 'Could not start app',
        description: getDisplayErrorMessage(error),
        variant: 'destructive'
      })
    }
  }

  const stopApp = async (app: AppDefinition) => {
    try {
      updateApp(optimisticStoppingApp(app), true)
      const updated = await stopApplicationAction(app.id)
      updateApp(mapAndroidApplicationToAppDefinition(updated))
    } catch (error) {
      updateApp(app)
      toast({
        title: 'Could not stop app',
        description: getDisplayErrorMessage(error),
        variant: 'destructive'
      })
    }
  }

  const deleteApp = async (app: AppDefinition) => {
    try {
      updateApp(optimisticRemovingApp(app), true)
      await deleteApplicationAction(app.id, settings.removeDataOnDelete)
      unwrapActionResult(await removeAppIconAction(app.id))
      await forgetRecentAppAction(app.id).then(notifyRecentAppsUpdated)
      removeApp(app.id)
    } catch (error) {
      updateApp(app)
      toast({
        title: 'Could not delete app',
        description: getDisplayErrorMessage(error),
        variant: 'destructive'
      })
    }
  }

  const toggleSelected = (id: string) => {
    setSelectedIds(current => {
      const next = new Set(current)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }

  const exitManageMode = () => {
    setIsManaging(false)
    setSelectedIds(new Set())
  }

  const sortedApps = useMemo(() => sortApps(apps, sortMode), [apps, sortMode])
  const { activeBulkApps, allSelected, deletableSelectedApps, stoppableSelectedApps } = deriveAppsListSelection({
    apps: sortedApps,
    selectedIds,
    currentOwnerUserId,
    bulkAction
  })

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
      return
    }

    setSelectedIds(new Set(sortedApps.map(app => app.id)))
  }

  const handleBulkStop = async (appsToStop: AppDefinition[]) => {
    setIsBulkWorking(true)
    appsToStop.forEach(app => {
      updateApp(optimisticStoppingApp(app), true)
    })

    const results = await Promise.allSettled(
      appsToStop.map(async app => {
        const updated = await stopApplicationAction(app.id)
        return mapAndroidApplicationToAppDefinition(updated)
      })
    )

    results.forEach((result, index) => {
      const originalApp = appsToStop[index]

      if (!originalApp) {
        return
      }

      if (result.status === 'fulfilled') {
        updateApp(result.value)
        return
      }

      updateApp(originalApp)
    })

    toast(summarizeBulkStopAppsResult(results))

    setIsBulkWorking(false)
    setBulkAction(null)
    exitManageMode()
  }

  const handleBulkDelete = async (appsToDelete: AppDefinition[]) => {
    setIsBulkWorking(true)
    appsToDelete.forEach(app => {
      updateApp(optimisticRemovingApp(app), true)
    })

    const results = await Promise.allSettled(
      appsToDelete.map(async app => {
        await deleteApplicationAction(app.id, settings.removeDataOnDelete)
        unwrapActionResult(await removeAppIconAction(app.id))
        await forgetRecentAppAction(app.id).then(notifyRecentAppsUpdated)
        return app.id
      })
    )
    const removedIds = fulfilledBulkDeleteAppIds(results)

    removedIds.forEach(removeApp)
    appsToDelete.forEach((app, index) => {
      if (results[index]?.status === 'rejected') {
        updateApp(app)
      }
    })

    toast(summarizeBulkDeleteAppsResult(results, removedIds))

    setIsBulkWorking(false)
    setBulkAction(null)
    exitManageMode()
  }

  const contextValue: AppsListContextValue = {
    activeBulkApps,
    allSelected,
    bulkAction,
    closeBulkAction: () => {
      if (!isBulkWorking) {
        setBulkAction(null)
      }
    },
    confirmBulkAction: async () => {
      if (bulkAction === 'stop') {
        await handleBulkStop(activeBulkApps)
        return
      }

      if (bulkAction === 'delete') {
        await handleBulkDelete(activeBulkApps)
      }
    },
    deleteApp,
    deletableSelectedCount: deletableSelectedApps.length,
    exitManageMode,
    isBulkWorking,
    isManaging,
    openBulkAction: setBulkAction,
    openPendingAppAction: setPendingAppAction,
    pendingAppAction,
    closePendingAppAction: () => {
      if (!isBulkWorking) {
        setPendingAppAction(null)
      }
    },
    confirmPendingAppAction: async () => {
      if (!pendingAppAction) {
        return
      }

      setPendingAppAction(null)
      if (pendingAppAction.action === 'stop') {
        await stopApp(pendingAppAction.app)
        return
      }

      await deleteApp(pendingAppAction.app)
    },
    removeDataOnDelete: settings.removeDataOnDelete,
    selectedIds,
    selectionCount: selectedIds.size,
    setSortMode,
    startApp,
    startManaging: () => setIsManaging(true),
    stopApp,
    sortMode,
    stoppableSelectedCount: stoppableSelectedApps.length,
    toggleSelected,
    toggleSelectAll
  }

  return {
    availableApps: sortedApps,
    contextValue,
    hasApps: apps.length > 0
  }
}
