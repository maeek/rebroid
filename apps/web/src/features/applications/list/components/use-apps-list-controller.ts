import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyApplicationPowerAcknowledgement,
  mapAndroidApplicationToAppDefinition
} from '@/features/applications/domain/app-mapper'
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
import {
  requestApplicationDeletionAction,
  requestApplicationStartAction,
  requestApplicationStopAction
} from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { sortApps, type AppsListSortMode } from '@/shared/model/applications/app-sort'
import { notifyRecentAppsUpdated } from '@/shared/model/recent-apps/recent-apps'
import { useOrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import { filterGalleryApps, type AppsGalleryStatus } from '../model/apps-gallery-filter'
import type { AppsListContextValue, BulkAction, PendingAppAction } from './apps-list-context'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AndroidApplication } from '@/shared/contracts/application'
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
  const refreshOverrideTimeoutMs = 60_000
  const [apps, setApps] = useState(yourApps)
  const [isManaging, setIsManaging] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AppsGalleryStatus>('all')
  const [sortMode, setSortMode] = useState<AppsListSortMode>('name-asc')
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null)
  const [pendingAppAction, setPendingAppAction] = useState<PendingAppAction | null>(null)
  const [isBulkWorking, setIsBulkWorking] = useState(false)
  const pendingRefreshOverridesRef = useRef<Map<string, AppsListRefreshOverride>>(new Map())
  const hiddenRemovingIdsRef = useRef<Set<string>>(new Set())
  const settings = useOrchestratorUiSettings(initialSettings, { refreshOnMount: false })
  const refreshIntervalMs = getAppsRefreshIntervalMs(apps, settings.appListRefreshIntervalSeconds * 1000)

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

  const applyRefresh = useCallback((refreshed: AppDefinition[], useRefreshedPresentation = false) => {
    setApps(current => {
      const { apps: nextApps, expiredOverrideIds } = mergeAppsListRefresh({
        currentApps: current,
        refreshedApps: refreshed,
        hiddenRemovingIds: hiddenRemovingIdsRef.current,
        pendingOverrides: pendingRefreshOverridesRef.current,
        nowMs: Date.now(),
        useRefreshedPresentation
      })

      expiredOverrideIds.forEach(id => pendingRefreshOverridesRef.current.delete(id))

      return nextApps
    })
  }, [])

  useEffect(() => {
    applyRefresh(yourApps, true)
  }, [applyRefresh, yourApps])

  useEffect(() => {
    if (refreshedApps) applyRefresh(refreshedApps.map(mapAndroidApplicationToAppDefinition))
  }, [applyRefresh, refreshedApps])

  const updateApp = (updatedApp: AppDefinition, preserveDuringRefresh = false, acknowledgedAfter?: number) => {
    if (preserveDuringRefresh) {
      pendingRefreshOverridesRef.current.set(updatedApp.id, {
        app: updatedApp,
        expiresAt: Date.now() + refreshOverrideTimeoutMs,
        acknowledgedAfter
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
      const command = unwrapActionResult(await requestApplicationStartAction(app.id))
      updateApp(applyApplicationPowerAcknowledgement(app, command), true, app.updatedAt.getTime())
    } catch (error) {
      updateApp(app)
      toast({
        title: 'Could not start app',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    }
  }

  const stopApp = async (app: AppDefinition) => {
    try {
      updateApp(optimisticStoppingApp(app), true)
      const command = unwrapActionResult(await requestApplicationStopAction(app.id))
      updateApp(applyApplicationPowerAcknowledgement(app, command), true, app.updatedAt.getTime())
    } catch (error) {
      updateApp(app)
      toast({
        title: 'Could not stop app',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    }
  }

  const requestDeletion = async (app: AppDefinition) => {
    const acknowledgement = unwrapActionResult(
      await requestApplicationDeletionAction(app.id, settings.removeDataOnDelete)
    )
    if (acknowledgement.deleted) removeApp(app.id)
    else updateApp(optimisticRemovingApp(app), true, app.updatedAt.getTime())
    return app.id
  }

  const deleteApp = async (app: AppDefinition) => {
    try {
      updateApp(optimisticRemovingApp(app), true)
      await requestDeletion(app)
      notifyRecentAppsUpdated()
    } catch (error) {
      updateApp(app)
      toast({
        title: 'Could not delete app',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
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
  const visibleApps = useMemo(
    () => filterGalleryApps(sortedApps, search, statusFilter),
    [sortedApps, search, statusFilter]
  )
  const visibleSelectedIds = retainVisibleSelectedIds(visibleApps, selectedIds)
  const { activeBulkApps, allSelected, deletableSelectedApps, stoppableSelectedApps } = deriveAppsListSelection({
    apps: visibleApps,
    selectedIds: visibleSelectedIds,
    currentOwnerUserId,
    bulkAction
  })

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
      return
    }

    setSelectedIds(new Set(visibleApps.map(app => app.id)))
  }

  const finishBulkAction = (requestedApps: AppDefinition[], results: PromiseSettledResult<unknown>[]) => {
    const failedIds = requestedApps.filter((_, index) => results[index]?.status === 'rejected').map(app => app.id)
    setIsBulkWorking(false)
    setBulkAction(null)
    if (failedIds.length > 0) setSelectedIds(new Set(failedIds))
    else exitManageMode()
  }

  const handleBulkStop = async (appsToStop: AppDefinition[]) => {
    setIsBulkWorking(true)
    appsToStop.forEach(app => {
      updateApp(optimisticStoppingApp(app), true)
    })

    const results = await Promise.allSettled(
      appsToStop.map(async app => {
        const command = unwrapActionResult(await requestApplicationStopAction(app.id))
        return applyApplicationPowerAcknowledgement(app, command)
      })
    )

    results.forEach((result, index) => {
      const originalApp = appsToStop[index]

      if (!originalApp) {
        return
      }

      if (result.status === 'fulfilled') {
        updateApp(result.value, true, originalApp.updatedAt.getTime())
        return
      }

      updateApp(originalApp)
    })

    toast(summarizeBulkStopAppsResult(results))

    finishBulkAction(appsToStop, results)
  }

  const handleBulkDelete = async (appsToDelete: AppDefinition[]) => {
    setIsBulkWorking(true)
    appsToDelete.forEach(app => {
      updateApp(optimisticRemovingApp(app), true)
    })

    const results = await Promise.allSettled(appsToDelete.map(requestDeletion))
    const acceptedIds = fulfilledBulkDeleteAppIds(results)
    if (acceptedIds.length > 0) notifyRecentAppsUpdated()

    appsToDelete.forEach((app, index) => {
      if (results[index]?.status === 'rejected') {
        updateApp(app)
      }
    })

    toast(summarizeBulkDeleteAppsResult(results, acceptedIds))

    finishBulkAction(appsToDelete, results)
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
    selectedIds: visibleSelectedIds,
    selectionCount: visibleSelectedIds.size,
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
    availableApps: visibleApps,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    contextValue,
    hasApps: apps.length > 0
  }
}
