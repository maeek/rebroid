import { Badge } from '@/components/ui/badge'
import { Visible } from '@/components/ui/visible'
import { AppViewerActions } from '@/features/applications/viewer/actions/app-viewer-actions'
import { AppInfo } from '@/features/applications/viewer/app-info/app-info'
import { AppViewerHeading } from '@/features/applications/viewer/components/heading'
import { AndroidNotifications } from '@/features/applications/viewer/notifications/android-notifications'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'
import { ProtectedSplitPageContent } from '@/features/shell/components/protected-page-shell'
import { AppViewerStatusSection } from './app-viewer-status-section'
import { useApplicationViewerApp } from './application-viewer-context'

export const AppViewerContent = () => {
  const { app, isForeignOwnedApp, permissions, setApp } = useApplicationViewerApp()

  return (
    <ProtectedSplitPageContent className='pr-2'>
      <div className='flex w-full flex-col gap-6'>
        <PageBreadcrumbs
          items={[{ label: 'Apps', href: '/apps' }, { label: app.name, href: `/app/${app.id}` }, { label: 'Details' }]}
        />
        <AppViewerHeading app={app}>
          <AppViewerActions mode='details' />
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
        onAppChange={setApp}
      />
      <div className='mt-4 flex w-full items-center justify-center gap-2 select-none text-lg font-black text-secondary-foreground md:hidden'>
        <div>•</div>
        <div>•</div>
        <div>•</div>
      </div>
    </ProtectedSplitPageContent>
  )
}
