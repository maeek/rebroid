import { Badge } from '@/components/ui/badge'
import { Visible } from '@/components/ui/visible'
import { AppViewerActions } from '@/features/applications/viewer/actions/app-viewer-actions'
import { AppInfo } from '@/features/applications/viewer/app-info/app-info'
import { AppViewerHeading } from '@/features/applications/viewer/components/heading'
import { AndroidNotifications } from '@/features/applications/viewer/notifications/android-notifications'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'
import { ProtectedSplitPageContent } from '@/features/shell/components/protected-page-shell'
import { AppViewerStatusSection } from './app-viewer-status-section'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { OrchestratorUiSettings } from '@/features/settings/hooks/use-orchestrator-ui-settings'
import type { PermissionMap } from '@/shared/permissions/permissions'

export const AppViewerContent = ({
  app,
  initialSettings,
  permissions,
  isForeignOwnedApp,
  onAppChange
}: {
  app: AppDefinition
  initialSettings: OrchestratorUiSettings
  permissions: PermissionMap
  isForeignOwnedApp: boolean
  onAppChange: (app: AppDefinition) => void
}) => {
  return (
    <ProtectedSplitPageContent className='pr-2'>
      <div className='flex w-full flex-col gap-6'>
        <PageBreadcrumbs
          items={[{ label: 'Apps', href: '/apps' }, { label: app.name, href: `/app/${app.id}` }, { label: 'Details' }]}
        />
        <AppViewerHeading app={app}>
          <AppViewerActions
            app={app}
            initialSettings={initialSettings}
            permissions={permissions}
            isForeignOwnedApp={isForeignOwnedApp}
            mode='details'
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
      <AndroidNotifications app={app} />
      <AppInfo
        app={app}
        permissions={permissions}
        onAppChange={onAppChange}
      />
      <div className='mt-4 flex w-full items-center justify-center gap-2 select-none text-lg font-black text-secondary-foreground md:hidden'>
        <div>•</div>
        <div>•</div>
        <div>•</div>
      </div>
    </ProtectedSplitPageContent>
  )
}
