import { Badge } from '@/components/ui/badge'
import { Visible } from '@/components/ui/visible'
import { AppViewerActions } from '@/features/applications/viewer/actions/app-viewer-actions'
import { AppViewerHeading } from '@/features/applications/viewer/components/heading'
import { RuntimeToolsPanel } from '@/features/applications/viewer/tools/runtime-tools-panel'
import { PageBreadcrumbs } from '@/shared/ui/page/page-breadcrumbs'
import { PageContent } from '@/shared/ui/page/page-layout'
import { AppViewerPane } from './app-viewer-pane'
import { useApplicationViewerApp } from './application-viewer-context'

export const AppWorkspaceContent = () => {
  const { app, isForeignOwnedApp } = useApplicationViewerApp()

  return (
    <>
      <PageContent className='min-w-0 gap-5 pr-6 lg:min-h-[calc(100dvh-4rem)] lg:flex-1 lg:self-stretch lg:items-stretch'>
        <div className='flex w-full grow flex-col gap-5 lg:min-h-0 lg:flex-1'>
          <PageBreadcrumbs items={[{ label: 'Apps', href: '/apps' }, { label: app.name }]} />
          <AppViewerHeading
            app={app}
            showStatusBadge
          >
            <AppViewerActions mode='workspace' />
          </AppViewerHeading>
          <Visible when={isForeignOwnedApp}>
            <Badge
              variant='outline'
              className='w-fit'
            >
              Owner: {app.ownerDisplayName ?? app.ownerUserId ?? 'Unknown'}
            </Badge>
          </Visible>
          <div className='hidden min-h-[24rem] grow flex-col lg:flex lg:min-h-0 lg:flex-1'>
            <RuntimeToolsPanel />
          </div>
        </div>
      </PageContent>
      <div className='flex w-full max-w-[min(100%,42rem)] items-start justify-center rounded-panel px-2 py-2 max-sm:px-1 max-sm:py-2 sm:p-4 lg:sticky lg:top-10 lg:min-h-[calc(100dvh-4rem)] lg:flex-1 lg:self-stretch lg:items-stretch lg:pr-4 lg:pt-6'>
        <AppViewerPane placement='top' />
      </div>
      <div className='w-full px-1 lg:hidden'>
        <RuntimeToolsPanel />
      </div>
    </>
  )
}
