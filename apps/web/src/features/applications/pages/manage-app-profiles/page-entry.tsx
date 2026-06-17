import { Suspense } from 'react'
import { AppManagePageSkeleton } from '@/features/applications/detail/app-page-skeleton'
import { AppManageProfiles } from '@/features/applications/manage/app-manage-profiles'
import { getApplicationPageData } from '@/server/orchestrator/applications/page-data'

const ManageAppProfilesPageContent = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  const { app, permissions } = await getApplicationPageData(slug)

  return (
    <AppManageProfiles
      app={app}
      permissions={permissions}
    />
  )
}

export const ManageAppProfilesPageEntry = ({ params }: { params: Promise<{ slug: string }> }) => {
  return (
    <Suspense fallback={<AppManagePageSkeleton />}>
      <ManageAppProfilesPageContent params={params} />
    </Suspense>
  )
}
