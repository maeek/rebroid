import { Suspense } from 'react'
import { AppViewerPage } from '@/features/applications/detail/app-page'
import { AppPageSkeleton } from '@/features/applications/detail/app-page-skeleton'
import { getApplicationPageData } from '@/server/orchestrator/applications/page-data'

const ApplicationViewerPageContent = async ({ params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params
  return <AppViewerPage {...await getApplicationPageData(slug)} />
}

export const ApplicationViewerPageEntry = ({ params }: { params: Promise<{ slug: string }> }) => {
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <ApplicationViewerPageContent params={params} />
    </Suspense>
  )
}
