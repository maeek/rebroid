import { useEffect, useRef, useState } from 'react'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { getAppsRefreshIntervalMs } from '@/features/applications/domain/refresh'
import { forgetRecentApp } from '@/features/applications/recent/recent-apps'
import { useOrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'
import { useForegroundRefresh } from '@/hooks/use-foreground-refresh'
import { toast } from '@/hooks/use-toast'
import { removeAppIconAction } from '@/server/app-icons/actions/remove-app-icon-action'
import {
  deleteApplicationAction,
  startApplicationAction,
  stopApplicationAction
} from '@/server/orchestrator/applications/mutation-actions'
import { listApplicationsAction } from '@/server/orchestrator/applications/read-actions'
import type { AppsListContextValue, BulkAction } from './apps-list-context'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { OrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'

export const useAppsListController = ({
  yourApps,
  initialSettings
}: {
  yourApps: AppDefinition[]
  initialSettings: OrchestratorUiSettings
}) => {
  const [apps, setApps] = useState(yourApps)
  const [isManaging, setIsManaging] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null)
  const [isBulkWorking, setIsBulkWorking] = useState(false)
  const pendingRefreshOverridesRef = useRef<Map<string, AppDefinition>>(new Map())
  const settings = useOrchestratorUiSettings(initialSettings, { refreshOnMount: false })
  const refreshIntervalMs = getAppsRefreshIntervalMs(apps, settings.appListRefreshIntervalSeconds * 1000)

  useEffect(() => {
    setApps(yourApps)
  }, [yourApps])

  useEffect(() => {
    setSelectedIds(current => new Set(apps.filter(app => current.has(app.id)).map(app => app.id)))

    if (apps.length === 0) {
      setIsManaging(false)
    }
  }, [apps])

  useForegroundRefresh({
    intervalMs: refreshIntervalMs,
    refresh: async () => {
      try {
        const items = await listApplicationsAction()
        setApps(current => {
          const currentIcons = new Map(current.map(app => [app.id, app.icon]))

          return items.map(item => {
            const app = mapAndroidApplicationToAppDefinition(item)
            const nextApp = { ...app, icon: currentIcons.get(app.id) ?? app.icon }
            return pendingRefreshOverridesRef.current.get(nextApp.id) ?? nextApp
          })
        })
      } catch {
        // Keep the current list on transient refresh failures.
      }
    }
  })

  const updateApp = (updatedApp: AppDefinition, preserveDuringRefresh = false) => {
    if (preserveDuringRefresh) {
      pendingRefreshOverridesRef.current.set(updatedApp.id, updatedApp)
    } else {
      pendingRefreshOverridesRef.current.delete(updatedApp.id)
    }

    setApps(current => current.map(app => (app.id === updatedApp.id ? updatedApp : app)))
  }

  const removeApp = (appId: string) => {
    pendingRefreshOverridesRef.current.delete(appId)
    setApps(current => current.filter(item => item.id !== appId))
  }

  const startApp = async (app: AppDefinition) => {
    try {
      updateApp(
        {
          ...app,
          running: false,
          status: 'provisioning',
          lifecycleStage: 'container_starting',
          statusMessage: 'Starting app.',
          statusDetail: {
            code: 'container_starting',
            title: 'Starting container',
            description: 'Starting app.',
            tone: 'progress'
          }
        },
        true
      )
      const updated = await startApplicationAction(app.id)
      updateApp(mapAndroidApplicationToAppDefinition(updated))
    } catch (error) {
      updateApp(app)
      toast({
        title: 'Could not start app',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    }
  }

  const stopApp = async (app: AppDefinition) => {
    try {
      updateApp(
        {
          ...app,
          running: false,
          status: 'stopped',
          lifecycleStage: 'stopping',
          statusMessage: 'Stopping app.',
          statusDetail: {
            code: 'stopping',
            title: 'Stopping app',
            description: 'Stopping app.',
            tone: 'progress'
          }
        },
        true
      )
      const updated = await stopApplicationAction(app.id)
      updateApp(mapAndroidApplicationToAppDefinition(updated))
    } catch (error) {
      updateApp(app)
      toast({
        title: 'Could not stop app',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    }
  }

  const deleteApp = async (app: AppDefinition) => {
    try {
      updateApp(
        {
          ...app,
          status: 'removing',
          lifecycleStage: 'removing',
          statusMessage: 'Removing app.',
          statusDetail: {
            code: 'removing',
            title: 'Removing app',
            description: 'Removing app.',
            tone: 'progress'
          }
        },
        true
      )
      await deleteApplicationAction(app.id, settings.removeDataOnDelete)
      await removeAppIconAction(app.id)
      forgetRecentApp(app.id)
      removeApp(app.id)
    } catch (error) {
      updateApp(app)
      toast({
        title: 'Could not delete app',
        description: error instanceof Error ? error.message : 'Unknown error',
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

  const sortedApps = apps.toSorted((a, b) => {
    if (a.running && !b.running) return -1
    if (!a.running && b.running) return 1
    return a.name.localeCompare(b.name)
  })
  const selectedApps = sortedApps.filter(app => selectedIds.has(app.id))
  const stoppableSelectedApps = selectedApps.filter(app => app.running && app.status !== 'removing')
  const deletableSelectedApps = selectedApps.filter(app => app.status !== 'removing')
  const allSelected = sortedApps.length > 0 && selectedIds.size === sortedApps.length
  const activeBulkApps = bulkAction === 'stop' ? stoppableSelectedApps : deletableSelectedApps

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
      updateApp(
        {
          ...app,
          running: false,
          status: 'stopped',
          lifecycleStage: 'stopping',
          statusMessage: 'Stopping app.',
          statusDetail: {
            code: 'stopping',
            title: 'Stopping app',
            description: 'Stopping app.',
            tone: 'progress'
          }
        },
        true
      )
    })

    const results = await Promise.allSettled(
      appsToStop.map(async app => {
        const updated = await stopApplicationAction(app.id)
        return mapAndroidApplicationToAppDefinition(updated)
      })
    )
    const failedCount = results.filter(result => result.status === 'rejected').length

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

    if (failedCount > 0) {
      toast({
        title: 'Some apps could not be stopped',
        description: `${failedCount} stop request failed.`,
        variant: 'destructive'
      })
    } else {
      toast({ title: 'Selected apps stopped' })
    }

    setIsBulkWorking(false)
    setBulkAction(null)
    exitManageMode()
  }

  const handleBulkDelete = async (appsToDelete: AppDefinition[]) => {
    setIsBulkWorking(true)
    appsToDelete.forEach(app => {
      updateApp(
        {
          ...app,
          status: 'removing',
          lifecycleStage: 'removing',
          statusMessage: 'Removing app.',
          statusDetail: {
            code: 'removing',
            title: 'Removing app',
            description: 'Removing app.',
            tone: 'progress'
          }
        },
        true
      )
    })

    const results = await Promise.allSettled(
      appsToDelete.map(async app => {
        await deleteApplicationAction(app.id, settings.removeDataOnDelete)
        await removeAppIconAction(app.id)
        forgetRecentApp(app.id)
        return app.id
      })
    )
    const removedIds = results
      .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
      .map(result => result.value)
    const failedCount = results.length - removedIds.length

    removedIds.forEach(removeApp)
    appsToDelete.forEach((app, index) => {
      if (results[index]?.status === 'rejected') {
        updateApp(app)
      }
    })

    if (failedCount > 0) {
      toast({
        title: 'Some apps could not be deleted',
        description: `${failedCount} delete request failed.`,
        variant: 'destructive'
      })
    } else {
      toast({ title: 'Selected apps deleted' })
    }

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
    removeDataOnDelete: settings.removeDataOnDelete,
    selectedIds,
    selectionCount: selectedIds.size,
    startApp,
    startManaging: () => setIsManaging(true),
    stopApp,
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
