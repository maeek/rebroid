'use client'

import { Visible } from '@/components/ui/visible'
import { cn } from '@/lib/utils'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { AppInfoArtifactsSection } from './app-info-artifacts-section'
import { AppInfoNetworkSection } from './app-info-network-section'
import { AppInfoOverviewSection } from './app-info-overview-section'
import { AppInfoRuntimeSection } from './app-info-runtime-section'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

export const AppInfo = ({
  app,
  className,
  permissions,
  onAppChange
}: {
  app?: AppDefinition
  className?: string
  permissions: PermissionMap
  onAppChange?: (app: AppDefinition) => void
}) => {
  const handleAppChange = onAppChange ?? (() => undefined)
  const canViewBackendDetails = hasPermission(permissions, 'applications:view-backend-details')
  const canConfigureEgress = hasPermission(permissions, 'applications:configure-egress')

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <AppInfoOverviewSection app={app} />
      <AppInfoRuntimeSection
        app={app}
        canViewBackendDetails={canViewBackendDetails}
      />
      <Visible when={canConfigureEgress || canViewBackendDetails}>
        <AppInfoNetworkSection
          app={app}
          canConfigureEgress={canConfigureEgress}
          canViewBackendDetails={canViewBackendDetails}
          onAppChange={handleAppChange}
        />
      </Visible>
      <AppInfoArtifactsSection app={app} />
    </div>
  )
}
