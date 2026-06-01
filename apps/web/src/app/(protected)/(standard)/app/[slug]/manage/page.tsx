import { Suspense } from 'react'
import { AppPageSkeleton } from '@/features/applications/detail/app-page-skeleton'
import AppManage from '@/features/applications/manage/app-manage'
import { getApplicationPageData } from '@/server/orchestrator/applications/page-data'

const AppManagePageContent = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  return <AppManage {...await getApplicationPageData(slug)} />
}

export default function ManagePage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <AppManagePageContent params={params} />
    </Suspense>
  )
}
