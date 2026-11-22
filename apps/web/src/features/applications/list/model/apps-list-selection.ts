import type { AppGalleryItem } from '@/shared/contracts/application-gallery'

type AppsListBulkAction = 'stop' | 'delete'

type AppsListOperationToast = {
  title: string
  description?: string
  variant?: 'danger'
}

export const deriveAppsListSelection = ({
  apps,
  selectedIds,
  currentOwnerUserId,
  canStop,
  canDelete,
  bulkAction
}: {
  apps: AppGalleryItem[]
  selectedIds: Set<string>
  currentOwnerUserId: string
  canStop: boolean
  canDelete: boolean
  bulkAction: AppsListBulkAction | null
}) => {
  const selectedApps = apps.filter(app => selectedIds.has(app.id))
  const stoppableSelectedApps = selectedApps.filter(
    app => canStop && app.ownerUserId === currentOwnerUserId && app.running && app.status !== 'removing'
  )
  const deletableSelectedApps = selectedApps.filter(app => canDelete && app.status !== 'removing')
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
      description: `${failedCount} stop ${failedCount === 1 ? 'request' : 'requests'} failed.`,
      variant: 'danger'
    }
  }

  return { title: 'Stop requested for selected apps' }
}

export const summarizeBulkDeleteAppsResult = (
  results: PromiseSettledResult<unknown>[],
  removedIds: string[]
): AppsListOperationToast => {
  const failedCount = results.length - removedIds.length

  if (failedCount > 0) {
    return {
      title: 'Some apps could not be deleted',
      description: `${failedCount} delete ${failedCount === 1 ? 'request' : 'requests'} failed.`,
      variant: 'danger'
    }
  }

  return { title: 'Removal requested for selected apps' }
}
