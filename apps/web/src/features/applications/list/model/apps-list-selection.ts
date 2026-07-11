import type { AppDefinition } from '@/features/applications/domain/app-definition'

type AppsListBulkAction = 'stop' | 'delete'

type AppsListOperationToast = {
  title: string
  description?: string
  variant?: 'danger'
}

export const retainVisibleSelectedIds = (apps: AppDefinition[], selectedIds: Set<string>) => {
  const visibleIds = new Set(apps.map(app => app.id))

  return new Set([...selectedIds].filter(id => visibleIds.has(id)))
}

export const deriveAppsListSelection = ({
  apps,
  selectedIds,
  currentOwnerUserId,
  bulkAction
}: {
  apps: AppDefinition[]
  selectedIds: Set<string>
  currentOwnerUserId: string
  bulkAction: AppsListBulkAction | null
}) => {
  const selectedApps = apps.filter(app => selectedIds.has(app.id))
  const stoppableSelectedApps = selectedApps.filter(
    app => app.ownerUserId === currentOwnerUserId && app.running && app.status !== 'removing'
  )
  const deletableSelectedApps = selectedApps.filter(app => app.status !== 'removing')
  const activeBulkApps = bulkAction === 'stop' ? stoppableSelectedApps : deletableSelectedApps

  return {
    activeBulkApps,
    allSelected: apps.length > 0 && selectedIds.size === apps.length,
    deletableSelectedApps,
    selectedApps,
    stoppableSelectedApps
  }
}

export const fulfilledBulkDeleteAppIds = (results: PromiseSettledResult<string>[]) =>
  results
    .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
    .map(result => result.value)

export const summarizeBulkStopAppsResult = (results: PromiseSettledResult<unknown>[]): AppsListOperationToast => {
  const failedCount = results.filter(result => result.status === 'rejected').length

  if (failedCount > 0) {
    return {
      title: 'Some apps could not be stopped',
      description: `${failedCount} stop request failed.`,
      variant: 'danger'
    }
  }

  return { title: 'Selected apps stopped' }
}

export const summarizeBulkDeleteAppsResult = (
  results: PromiseSettledResult<unknown>[],
  removedIds: string[]
): AppsListOperationToast => {
  const failedCount = results.length - removedIds.length

  if (failedCount > 0) {
    return {
      title: 'Some apps could not be deleted',
      description: `${failedCount} delete request failed.`,
      variant: 'danger'
    }
  }

  return { title: 'Selected apps deleted' }
}
