import { Suspense } from 'react'
import { AppDeviceLayout } from '@/features/applications/detail/app-device-layout'
import { AppProfilesPageSkeleton } from '@/features/applications/detail/app-page-skeleton'
import { AppViewerPane } from '@/features/applications/detail/app-viewer-pane'
import { ApplicationViewerProvider } from '@/features/applications/detail/application-viewer-context'
import { AppManageProfiles } from '@/features/applications/manage/app-manage-profiles'
import { getApplicationPageData } from '@/features/applications/pages/shared/application-page-data.server'

const ManageAppProfilesPageContent = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const data = await getApplicationPageData(slug)

  return (
    <ApplicationViewerProvider {...data}>
      <AppDeviceLayout viewer={data.app ? <AppViewerPane placement='top' /> : null}>
        <AppManageProfiles
          app={data.app}
          permissions={data.permissions}
        />
      </AppDeviceLayout>
    </ApplicationViewerProvider>
  )
}

export const ManageAppProfilesPageEntry = ({ params }: { params: Promise<{ slug: string }> }) => {
  return (
    <Suspense fallback={<AppProfilesPageSkeleton />}>
      <ManageAppProfilesPageContent params={params} />
    </Suspense>
  )
}
