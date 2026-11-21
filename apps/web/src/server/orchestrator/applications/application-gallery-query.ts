import 'server-only'
import { getOwnerDisplayName, getVisibleOwnerDisplayNames } from '@/server/users/owner-display-names'
import { getCurrentUserContext } from '../current-user'
import { orchestratorAppCatalogClient } from './catalog-client'
import type { ApplicationGalleryRow } from '@/shared/contracts/application-gallery'

export const listApplicationGallery = async (
  user: Awaited<ReturnType<typeof getCurrentUserContext>>
): Promise<ApplicationGalleryRow[]> => {
  const owner = user.isPlatformAdmin ? undefined : user.ownerUserId
  const rows = await orchestratorAppCatalogClient.listApplicationGallery(owner)
  const visible = owner === undefined ? rows : rows.filter(row => row.ownerUserId === owner)
  const ownerNames = user.isPlatformAdmin
    ? await getVisibleOwnerDisplayNames(user, [
        ...new Set(visible.flatMap(row => (row.ownerUserId ? [row.ownerUserId] : [])))
      ])
    : null
  return visible.map(
    ({ id, name, ownerUserId, status, lifecycleStage, containerImage, apkPackageName, updatedAt }) => ({
      id,
      name,
      ownerUserId,
      status,
      lifecycleStage,
      containerImage,
      apkPackageName,
      updatedAt,
      ownerDisplayName: ownerNames ? getOwnerDisplayName(ownerNames, ownerUserId) : null
    })
  )
}
