import { PageBreadcrumbs } from '@/app/(protected)/_components/page-breadcrumbs'
import { ProtectedSplitPageContent } from '@/app/(protected)/_components/protected-page-shell'
import { AndroidNotifications } from '@/app/(protected)/_components/viewer/notifications'
import { AppViewerActions } from '../../../_components/viewer/actions'
import { AppViewerHeading } from '../../../_components/viewer/heading'
import { AppInfo } from '../../../_components/viewer/info'
import { AppViewerStatusSection } from './app-viewer-status-section'
import type { AppDefinition } from '../../constants'

export const AppViewerContent = ({
  app,
  onAppChange
}: {
  app: AppDefinition
  onAppChange: (app: AppDefinition) => void
}) => {
  return (
    <ProtectedSplitPageContent className='pr-2'>
      <div className='flex w-full flex-col gap-6'>
        <PageBreadcrumbs items={[{ label: 'Apps', href: '/apps' }, { label: app.name }]} />
        <AppViewerHeading app={app}>
          <AppViewerActions app={app} />
        </AppViewerHeading>
      </div>
      <AppViewerStatusSection app={app} />
      <AndroidNotifications app={app} />
      <AppInfo
        app={app}
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
