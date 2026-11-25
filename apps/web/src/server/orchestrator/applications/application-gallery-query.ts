import 'server-only'
import { getOwnerDisplayName, getVisibleOwnerDisplayNames } from '@/server/users/owner-display-names'
import { getCurrentUserContext } from '../current-user'
import { orchestratorAppCatalogClient } from './catalog-client'
import type { ApplicationGalleryRow } from '@/shared/contracts/application-gallery'

type GalleryUser = Awaited<ReturnType<typeof getCurrentUserContext>>

const listVisibleGalleryRows = async (user: GalleryUser) => {
  const owner = user.isPlatformAdmin ? undefined : user.ownerUserId
  const rows = await orchestratorAppCatalogClient.listApplicationGallery(owner)
  return owner === undefined ? rows : rows.filter(row => row.ownerUserId === owner)
}

export const listApplicationNames = async (user: GalleryUser) =>
  (await listVisibleGalleryRows(user)).map(({ id, name }) => ({ id, name }))

export const listApplicationGallery = async (user: GalleryUser): Promise<ApplicationGalleryRow[]> => {
  const visible = await listVisibleGalleryRows(user)
  const ownerNames = user.isPlatformAdmin
    ? await getVisibleOwnerDisplayNames(user, [
        ...new Set(visible.flatMap(row => (row.ownerUserId ? [row.ownerUserId] : [])))
      ])
    : null
  return visible.map(
    ({
      id,
      kind,
      operations,
      name,
      ownerUserId,
      status,
      lifecycleStage,
      containerImage,
      apkPackageName,
      updatedAt
    }) => ({
      id,
      kind,
      operations,
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
