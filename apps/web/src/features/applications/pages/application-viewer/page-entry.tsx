import { Suspense } from 'react'
import { AppViewerPage } from '@/features/applications/detail/app-page'
import { AppPageSkeleton } from '@/features/applications/detail/app-page-skeleton'
import { getApplicationPageData } from '@/features/applications/pages/shared/application-page-data.server'

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
