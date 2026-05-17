import { AppViewerActions } from '@/features/applications/viewer/actions'
import { AppViewerHeading } from '@/features/applications/viewer/heading'
import { AppInfo } from '@/features/applications/viewer/info'
import { AndroidNotifications } from '@/features/applications/viewer/notifications'
import { PageBreadcrumbs } from '@/features/shell/components/page-breadcrumbs'
import { ProtectedSplitPageContent } from '@/features/shell/components/protected-page-shell'
import { AppViewerStatusSection } from './app-viewer-status-section'
import type { AppDefinition } from '@/features/applications/domain/app-definition'

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
