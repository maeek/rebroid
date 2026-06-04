import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Visible } from '@/components/ui/visible'
import { AppViewerActions } from '@/features/applications/viewer/actions/app-viewer-actions'
import { AppViewerHeading } from '@/features/applications/viewer/components/heading'
import { RuntimeToolsPanel } from '@/features/applications/viewer/tools/runtime-tools-panel'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'
import { ProtectedSplitPageContent } from '@/features/shell/components/protected-page-shell'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ViewerSettings } from '@/features/applications/viewer/settings/viewer-settings'
import type { OrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'
import type { PermissionMap } from '@/shared/permissions/permissions'

export const AppWorkspaceContent = ({
  app,
  initialSettings,
  permissions,
  isForeignOwnedApp,
  viewerSettings,
  viewerSlot,
  onAppChange,
  onViewerSettingsChange
}: {
  app: AppDefinition
  initialSettings: OrchestratorUiSettings
  permissions: PermissionMap
  isForeignOwnedApp: boolean
  viewerSettings: ViewerSettings
  viewerSlot?: ReactNode
  onAppChange: (app: AppDefinition) => void
  onViewerSettingsChange: (settings: ViewerSettings) => void
}) => (
  <ProtectedSplitPageContent className='gap-5 pr-6'>
    <div className='flex w-full flex-col gap-5'>
      <PageBreadcrumbs items={[{ label: 'Apps', href: '/apps' }, { label: app.name }]} />
      <AppViewerHeading
        app={app}
        showStatusBadge
      >
        <AppViewerActions
          app={app}
          initialSettings={initialSettings}
          permissions={permissions}
          isForeignOwnedApp={isForeignOwnedApp}
          mode='workspace'
        />
      </AppViewerHeading>
      <Visible when={isForeignOwnedApp}>
        <Badge
          variant='outline'
          className='w-fit'
        >
          Owner: {app.ownerDisplayName ?? app.ownerUserId ?? 'Unknown'}
        </Badge>
      </Visible>
    </div>
    <Visible when={viewerSlot}>
      <div className='flex w-full justify-center rounded-lg p-2 max-sm:px-1 max-sm:py-2 sm:p-4'>{viewerSlot}</div>
    </Visible>
    <RuntimeToolsPanel
      app={app}
      permissions={permissions}
      viewerSettings={viewerSettings}
      onAppChange={onAppChange}
      onViewerSettingsChange={onViewerSettingsChange}
    />
  </ProtectedSplitPageContent>
)
