import { Suspense } from 'react'
import { AppManagePageSkeleton } from '@/features/applications/detail/app-page-skeleton'
import AppManage from '@/features/applications/manage/app-manage'
import { getApplicationPageData } from '@/features/applications/pages/shared/application-page-data.server'

const ManageAppPageContent = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  return <AppManage {...await getApplicationPageData(slug)} />
}

export const ManageAppPageEntry = ({ params }: { params: Promise<{ slug: string }> }) => {
  return (
    <Suspense fallback={<AppManagePageSkeleton />}>
      <ManageAppPageContent params={params} />
    </Suspense>
  )
}
