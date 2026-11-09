import 'server-only'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import type { UserRole } from '@/shared/contracts/auth-user'

export type ApplicationImageActor = { role: UserRole; permissions: PermissionMap }

export const applicationImageAccessHeaders = ({ role, permissions }: ApplicationImageActor) => {
  const redroid = hasPermission(permissions, 'applications:use-redroid-images')
  const custom = hasPermission(permissions, 'applications:use-custom-images')
  let access = 'none'
  if (role === 'admin') access = 'admin'
  else if (redroid && custom) access = 'all'
  else if (redroid) access = 'redroid'
  else if (custom) access = 'custom'
  return { 'x-rebroid-image-access': access }
}
