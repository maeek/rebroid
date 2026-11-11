import 'server-only'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'

export const viewerCapabilitiesFor = (permissions: PermissionMap) => ({
  control: hasPermission(permissions, 'applications:control-viewer'),
  clipboard: hasPermission(permissions, 'applications:sync-clipboard'),
  screenshot: hasPermission(permissions, 'applications:capture-screenshot')
})
