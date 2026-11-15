import { Badge } from '@/components/ui/badge'
import { Visible } from '@/components/ui/visible'
import { AppViewerActions } from '@/features/applications/viewer/actions/app-viewer-actions'
import { AppInfo } from '@/features/applications/viewer/app-info/app-info'
import { AppViewerHeading } from '@/features/applications/viewer/components/heading'
import { PageBreadcrumbRow } from '@/shared/ui/page/page-breadcrumbs'
import { PageContent } from '@/shared/ui/page/page-layout'
import { AppResourceBreadcrumbs } from './app-resource-breadcrumbs'
import { AppViewerStatusSection } from './app-viewer-status-section'
import { useApplicationViewerApp } from './application-viewer-context'

export const AppViewerContent = () => {
  const { app, isForeignOwnedApp, permissions } = useApplicationViewerApp()

  return (
    <PageContent className='pr-2'>
      <div className='flex w-full flex-col gap-6'>
        <PageBreadcrumbRow className='mt-(--page-header-top-inset)'>
          <AppResourceBreadcrumbs appName={app.name} />
        </PageBreadcrumbRow>
        <AppViewerHeading
          app={app}
          showStatusBadge
        >
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
      <AppInfo
        app={app}
        permissions={permissions}
      />
      <div className='mt-4 flex w-full items-center justify-center gap-2 select-none text-lg font-bold text-foreground-muted md:hidden'>
        <div>•</div>
        <div>•</div>
        <div>•</div>
      </div>
    </PageContent>
  )
}
