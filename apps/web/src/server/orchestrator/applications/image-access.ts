import 'server-only'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'

export type ApplicationImageActor = { isPlatformAdmin: boolean; permissions: PermissionMap }

export const applicationImageAccessHeaders = ({ isPlatformAdmin, permissions }: ApplicationImageActor) => {
  const redroid = hasPermission(permissions, 'applications:use-redroid-images')
  const custom = hasPermission(permissions, 'applications:use-custom-images')
  let access = 'none'
  if (isPlatformAdmin) access = 'admin'
  else if (redroid && custom) access = 'all'
  else if (redroid) access = 'redroid'
  else if (custom) access = 'custom'
  return { 'x-rebroid-image-access': access }
}
