import { isAppInProgress, type AppsGalleryStatus } from '@/shared/model/applications/app-gallery-status'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

export type AppsGalleryOwnership = 'all' | 'mine' | 'others'

export const filterGalleryApps = (apps: AppDefinition[], search: string, status: AppsGalleryStatus) => {
  const query = search.trim().toLocaleLowerCase()
  return apps.filter(app => {
    let matchesStatus = status === 'all' || app.status === status
    if (status === 'working') matchesStatus = isAppInProgress(app.status, app.lifecycleStage)
    return (
      matchesStatus &&
      [app.name, app.apkPackageName, app.containerImage, app.ownerDisplayName, app.id].some(value =>
        value?.toLocaleLowerCase().includes(query)
      )
    )
  })
}
