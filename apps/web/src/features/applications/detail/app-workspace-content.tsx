import { Badge } from '@/components/ui/badge'
import { Visible } from '@/components/ui/visible'
import { AppViewerActions } from '@/features/applications/viewer/actions/app-viewer-actions'
import { AppViewerHeading } from '@/features/applications/viewer/components/heading'
import { RuntimeToolsPanel } from '@/features/applications/viewer/tools/runtime-tools-panel'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'
import { ProtectedSplitPageContent } from '@/features/shell/components/protected-page-shell'
import { AppViewerPane } from './app-viewer-pane'
import { useApplicationViewerApp } from './application-viewer-context'

export const AppWorkspaceContent = () => {
  const { app, isForeignOwnedApp } = useApplicationViewerApp()

  return (
    <ProtectedSplitPageContent className='gap-5 pr-6'>
      <div className='flex w-full flex-col gap-5'>
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
      </div>
      <div className='flex w-full justify-center rounded-lg p-2 max-sm:px-1 max-sm:py-2 sm:p-4'>
        <AppViewerPane placement='top' />
      </div>
      <RuntimeToolsPanel />
    </ProtectedSplitPageContent>
  )
}
