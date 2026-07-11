import { Badge } from '@/components/ui/badge'
import { Visible } from '@/components/ui/visible'
import { AppViewerActions } from '@/features/applications/viewer/actions/app-viewer-actions'
import { AppInfo } from '@/features/applications/viewer/app-info/app-info'
import { AppViewerHeading } from '@/features/applications/viewer/components/heading'
import { AndroidNotifications } from '@/features/applications/viewer/notifications/android-notifications'
import { PageBreadcrumbs } from '@/shared/ui/page/page-breadcrumbs'
import { PageContent } from '@/shared/ui/page/page-layout'
import { AppViewerStatusSection } from './app-viewer-status-section'
import { useApplicationViewerApp } from './application-viewer-context'

export const AppViewerContent = () => {
  const { app, isForeignOwnedApp, permissions, setApp } = useApplicationViewerApp()

  return (
    <PageContent className='pr-2'>
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
      <div className='mt-4 flex w-full items-center justify-center gap-2 select-none text-lg font-bold text-foreground-muted md:hidden'>
        <div>•</div>
        <div>•</div>
        <div>•</div>
      </div>
    </PageContent>
  )
}
