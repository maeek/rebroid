'use client'

import {
  IconActivity,
  IconClipboard,
  IconFolder,
  IconLayoutDashboard,
  IconRobot,
  IconSettings,
  IconStethoscope
} from '@tabler/icons-react'
import { GradientSparklesIcon } from '@/components/icons/gradient-sparkles-icon'
import { getRuntimeTools } from '@/features/applications/viewer/tools/runtime-tools-panel/runtime-tool-definitions'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { ResourceNavigation } from '@/shared/ui/resource-navigation'
import { appResourceHref, appResourceLabels, type AppResourceView } from './app-resource-links'

const appTabs = [
  { view: 'overview', Icon: IconLayoutDashboard },
  { view: 'ai-agent', Icon: GradientSparklesIcon },
  { view: 'workflows', Icon: IconRobot },
  { view: 'files', Icon: IconFolder },
  { view: 'clipboard', Icon: IconClipboard },
  { view: 'activity', Icon: IconActivity },
  { view: 'diagnostics', Icon: IconStethoscope },
  { view: 'configuration', Icon: IconSettings }
] as const

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
  const visibleViews = new Set<AppResourceView>(['overview', 'configuration'])
  if (!isForeignOwnedApp) {
    for (const tool of getRuntimeTools({ permissions })) visibleViews.add(tool.id)
  }
  if (canViewAuditActivity) visibleViews.add('activity')
  if (canDiagnose) visibleViews.add('diagnostics')

  return (
    <ResourceNavigation
      label='App sections'
      preserveScroll
      items={appTabs
        .filter(({ view }) => visibleViews.has(view))
        .map(({ view, Icon }) => ({
          id: view,
          label: appResourceLabels[view],
          icon: <Icon className='size-3.5' />,
          href: loading ? undefined : appResourceHref(appId, view),
          current: active === view || (view === 'configuration' && active === 'profiles')
        }))}
    />
  )
}
