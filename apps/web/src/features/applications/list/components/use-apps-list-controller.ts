import { startTransition, useCallback, useEffect, useMemo, useOptimistic, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getAppsRefreshIntervalMs } from '@/features/applications/domain/refresh'
import {
  applyGalleryPowerAcknowledgement,
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
  summarizeBulkDeleteAppsResult,
  summarizeBulkStopAppsResult
} from '@/features/applications/list/model/apps-list-selection'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { toast } from '@/hooks/use-toast'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { getBff } from '@/lib/http/bff'
import {
  requestApplicationDeletionAction,
  requestApplicationStartAction,
  requestApplicationStopAction
} from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { toAppGalleryItem } from '@/shared/contracts/application-gallery'
import {
  appGalleryStatusParam,
  parseAppGalleryStatus,
  type AppsGalleryStatus
} from '@/shared/model/applications/app-gallery-status'
import { sortApps, type AppsListSortMode } from '@/shared/model/applications/app-sort'
import { notifyRecentAppsUpdated } from '@/shared/model/recent-apps/recent-apps'
import { useOrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import { retainVisibleSelectedIds } from '@/shared/model/visible-selection'
import { filterGalleryApps, type AppsGalleryOwnership } from '../model/apps-gallery-filter'
import type { AppsListContextValue, BulkAction, BulkAppProgress, PendingAppAction } from './apps-list-context'
import type { AppGalleryItem, ApplicationGalleryRow } from '@/shared/contracts/application-gallery'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

const listApplications = () => getBff<ApplicationGalleryRow[]>('/api/bff/apps/gallery')

export const useAppsListController = ({
  canStop,
  canDelete,
  currentOwnerUserId,
  yourApps,
  initialSettings
}: {
  canStop: boolean
  canDelete: boolean
  currentOwnerUserId: string
  yourApps: AppGalleryItem[]
  initialSettings: OrchestratorUiSettings
}) => {
  const refreshOverrideTimeoutMs = 60_000
  const [apps, setApps] = useState(yourApps)
  const [isManaging, setIsManaging] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [search, setSearch] = useState('')
  const searchParams = useSearchParams()
  const [statusFilter, setOptimisticStatus] = useOptimistic(
    parseAppGalleryStatus(searchParams?.get(appGalleryStatusParam))
  )
  const [ownershipFilter, setOwnershipFilter] = useState<AppsGalleryOwnership>('all')
  const [sortMode, setSortMode] = useState<AppsListSortMode>('name-asc')
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null)
  const [pendingAppAction, setPendingAppAction] = useState<PendingAppAction | null>(null)
  const [bulkProgress, setBulkProgress] = useState<BulkAppProgress | null>(null)
  const bulkInFlight = useRef(false)
  const isBulkWorking = bulkProgress !== null
  const pendingRefreshOverridesRef = useRef<Map<string, AppsListRefreshOverride>>(new Map())
  const hiddenRemovingIdsRef = useRef<Set<string>>(new Set())
  const settings = useOrchestratorUiSettings(initialSettings)
  const refreshIntervalMs = getAppsRefreshIntervalMs(apps, settings.appListRefreshIntervalSeconds * 1000)

  const setStatusFilter = (status: AppsGalleryStatus) => {
    const url = new URL(window.location.href)
    if (status === 'all') url.searchParams.delete(appGalleryStatusParam)
    else url.searchParams.set(appGalleryStatusParam, status)
    startTransition(() => {
      setOptimisticStatus(status)
      window.history.replaceState(null, '', url)
    })
  }

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

  const applyRefresh = useCallback((refreshed: AppGalleryItem[], useRefreshedPresentation = false) => {
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
    if (refreshedApps) applyRefresh(refreshedApps.map(toAppGalleryItem))
  }, [applyRefresh, refreshedApps])

  const updateApp = (updatedApp: AppGalleryItem, preserveDuringRefresh = false, acknowledgedAfter?: number) => {
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

  const startApp = async (app: AppGalleryItem) => {
    try {
      updateApp(optimisticStartingApp(app), true)
      const command = unwrapActionResult(await requestApplicationStartAction(app.id))
      updateApp(applyGalleryPowerAcknowledgement(app, command), true, app.updatedAt.getTime())
    } catch (error) {
      updateApp(app)
      toast({
        title: 'Could not start app',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    }
  }

  const stopApp = async (app: AppGalleryItem) => {
    try {
      updateApp(optimisticStoppingApp(app), true)
      const command = unwrapActionResult(await requestApplicationStopAction(app.id))
      updateApp(applyGalleryPowerAcknowledgement(app, command), true, app.updatedAt.getTime())
      notifyRecentAppsUpdated()
    } catch (error) {
      updateApp(app)
      toast({
        title: 'Could not stop app',
        description: getDisplayErrorMessage(error),
        variant: 'danger'
      })
    }
  }

  const requestDeletion = async (app: AppGalleryItem, removeDataOnDelete: boolean) => {
    const acknowledgement = unwrapActionResult(await requestApplicationDeletionAction(app.id, removeDataOnDelete))
    if (acknowledgement.deleted) removeApp(app.id)
    else updateApp(optimisticRemovingApp(app), true, app.updatedAt.getTime())
    return app.id
  }

  const deleteApp = async (app: AppGalleryItem) => {
    try {
      updateApp(optimisticRemovingApp(app), true)
      await requestDeletion(app, settings.removeDataOnDelete)
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
  const visibleApps = useMemo(() => {
    const scopedApps =
      ownershipFilter === 'all'
        ? sortedApps
        : sortedApps.filter(app => (app.ownerUserId === currentOwnerUserId) === (ownershipFilter === 'mine'))
    return filterGalleryApps(scopedApps, search, statusFilter)
  }, [currentOwnerUserId, sortedApps, search, statusFilter, ownershipFilter])
  const visibleSelectedIds = retainVisibleSelectedIds(visibleApps, selectedIds)
  const { activeBulkApps, allSelected, deletableSelectedApps, stoppableSelectedApps } = deriveAppsListSelection({
    apps: visibleApps,
    selectedIds: visibleSelectedIds,
    currentOwnerUserId,
    canStop,
    canDelete,
    bulkAction
  })

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
      return
    }

    setSelectedIds(new Set(visibleApps.map(app => app.id)))
  }

  const finishBulkAction = (requestedApps: AppGalleryItem[], results: PromiseSettledResult<unknown>[]) => {
    const failedIds = requestedApps.filter((_, index) => results[index]?.status === 'rejected').map(app => app.id)
    setBulkAction(null)
    if (failedIds.length > 0) setSelectedIds(new Set(failedIds))
    else exitManageMode()
  }

  const confirmBulkAction = async () => {
    if (!bulkAction || activeBulkApps.length === 0 || bulkInFlight.current) return
    const requestedApps = activeBulkApps
    const removeDataOnDelete = settings.removeDataOnDelete
    const stopping = bulkAction === 'stop'
    bulkInFlight.current = true
    setBulkProgress({ apps: requestedApps, removeDataOnDelete, accepted: 0, failed: 0 })
    const updateProgress = (outcome: 'accepted' | 'failed') => {
      setBulkProgress(current => current && { ...current, [outcome]: current[outcome] + 1 })
    }

    try {
      const optimisticApp = stopping ? optimisticStoppingApp : optimisticRemovingApp
      requestedApps.forEach(app => updateApp(optimisticApp(app), true))
      const results = await Promise.allSettled(
        requestedApps.map(async app => {
          try {
            if (stopping) {
              const command = unwrapActionResult(await requestApplicationStopAction(app.id))
              updateApp(applyGalleryPowerAcknowledgement(app, command), true, app.updatedAt.getTime())
            } else {
              await requestDeletion(app, removeDataOnDelete)
            }
            updateProgress('accepted')
            return app.id
          } catch (error) {
            updateApp(app)
            updateProgress('failed')
            throw error
          }
        })
      )

      if (results.some(result => result.status === 'fulfilled')) notifyRecentAppsUpdated()
      toast(
        stopping
          ? summarizeBulkStopAppsResult(results)
          : summarizeBulkDeleteAppsResult(results, fulfilledBulkDeleteAppIds(results))
      )
      finishBulkAction(requestedApps, results)
    } finally {
      bulkInFlight.current = false
      setBulkProgress(null)
    }
  }

  const contextValue: AppsListContextValue = {
    activeBulkApps,
    allSelected,
    bulkAction,
    bulkProgress,
    canStop,
    canDelete,
    closeBulkAction: () => {
      if (!bulkInFlight.current) {
        setBulkAction(null)
      }
    },
    confirmBulkAction,
    deleteApp,
    deletableSelectedCount: deletableSelectedApps.length,
    exitManageMode,
    isBulkWorking,
    isManaging,
    openBulkAction: action => {
      if (bulkInFlight.current) return
      if (action === 'stop' ? stoppableSelectedApps.length > 0 : deletableSelectedApps.length > 0) {
        setBulkAction(action)
      }
    },
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
        if (!canStop || pendingAppAction.app.ownerUserId !== currentOwnerUserId) return
        await stopApp(pendingAppAction.app)
        return
      }

      if (canDelete) await deleteApp(pendingAppAction.app)
    },
    removeDataOnDelete: settings.removeDataOnDelete,
    selectedIds: visibleSelectedIds,
    selectionCount: visibleSelectedIds.size,
    setSortMode,
    startApp,
    startManaging: initialId => {
      setSelectedIds(initialId ? new Set([initialId]) : new Set())
      setIsManaging(true)
    },
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
    ownershipFilter,
    setOwnershipFilter,
    contextValue,
    hasApps: apps.length > 0
  }
}
