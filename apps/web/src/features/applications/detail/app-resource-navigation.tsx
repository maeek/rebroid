'use client'

import { getRuntimeTools } from '@/features/applications/viewer/tools/runtime-tools-panel/runtime-tool-definitions'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { ResourceNavigation } from '@/shared/ui/resource-navigation'
import { appResourceHref, appResourceLabels, type AppResourceView } from './app-resource-links'

export const AppResourceNavigation = ({
  appId,
  active,
  permissions,
  isForeignOwnedApp,
  canViewAuditActivity = false,
  loading = false
}: {
  loading?: boolean
  appId: string
  active: AppResourceView
  permissions: PermissionMap
  isForeignOwnedApp: boolean
  canViewAuditActivity?: boolean
}) => {
  const canDiagnose =
    hasPermission(permissions, 'applications:view-backend-details') ||
    (!isForeignOwnedApp && hasPermission(permissions, 'applications:view-logs'))
  const views: AppResourceView[] = ['overview', 'configuration']
  if (canViewAuditActivity) views.push('activity')
  if (canDiagnose) views.push('diagnostics')
  if (!isForeignOwnedApp) views.push(...getRuntimeTools({ permissions }).map(tool => tool.id))
  return (
    <ResourceNavigation
      label='App sections'
      items={views.map(view => ({
        id: view,
        label: appResourceLabels[view],
        href: loading ? undefined : appResourceHref(appId, view),
        current: active === view || (view === 'configuration' && active === 'profiles')
      }))}
    />
  )
}
