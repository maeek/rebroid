import { Badge } from '@/components/ui/badge'
import { Visible } from '@/components/ui/visible'
import { AppViewerActions } from '@/features/applications/viewer/actions'
import { AppViewerHeading } from '@/features/applications/viewer/heading'
import { RuntimeToolsPanel } from '@/features/applications/viewer/runtime-tools-panel'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'
import { ProtectedSplitPageContent } from '@/features/shell/components/protected-page-shell'
import { AppViewerStatusSection } from './app-viewer-status-section'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ViewerSettings } from '@/features/applications/viewer/viewer-settings'
import type { OrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'
import type { PermissionMap } from '@/shared/permissions/permissions'

export const AppWorkspaceContent = ({
  app,
  initialSettings,
  permissions,
  isForeignOwnedApp,
  viewerSettings,
  onViewerSettingsChange
}: {
  app: AppDefinition
  initialSettings: OrchestratorUiSettings
  permissions: PermissionMap
  isForeignOwnedApp: boolean
  viewerSettings: ViewerSettings
  onViewerSettingsChange: (settings: ViewerSettings) => void
}) => (
  <ProtectedSplitPageContent className='gap-5 pr-2'>
    <div className='flex w-full flex-col gap-5'>
      <PageBreadcrumbs items={[{ label: 'Apps', href: '/apps' }, { label: app.name }]} />
      <AppViewerHeading app={app}>
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
    <AppViewerStatusSection app={app} />
    <RuntimeToolsPanel
      app={app}
      permissions={permissions}
      viewerSettings={viewerSettings}
      onViewerSettingsChange={onViewerSettingsChange}
    />
  </ProtectedSplitPageContent>
)
