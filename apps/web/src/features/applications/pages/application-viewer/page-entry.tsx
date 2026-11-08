import { Suspense, type ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { AppViewerPage } from '@/features/applications/detail/app-page'
import { AppPageSkeleton } from '@/features/applications/detail/app-page-skeleton'
import { appResourceHref } from '@/features/applications/detail/app-resource-links'
import { ManageAppPageEntry } from '@/features/applications/pages/manage-app/page-entry'
import { ManageAppProfilesPageEntry } from '@/features/applications/pages/manage-app-profiles/page-entry'
import { getApplicationPageData } from '@/features/applications/pages/shared/application-page-data.server'
import { getRuntimeTools } from '@/features/applications/viewer/tools/runtime-tools-panel/runtime-tool-definitions'
import { loadApplicationActivity } from '@/server/audit/application-activity-query'
import { firstSearchParamValue } from '@/shared/model/search-params'
import type { AuditSearchParams } from '@/shared/contracts/audit'

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<AuditSearchParams>
  loadingActivity?: ReactNode
  renderActivity: (
    props: Awaited<ReturnType<typeof loadApplicationActivity>> & { application: { id: string; name: string } }
  ) => ReactNode
}
const ApplicationViewerPageContent = async ({ params, searchParams, renderActivity }: PageProps) => {
  const [{ slug }, search] = await Promise.all([params, searchParams])
  const view = firstSearchParamValue(search.view)
  if (view === 'configuration') return <ManageAppPageEntry params={Promise.resolve({ slug })} />
  if (view === 'profiles') return <ManageAppProfilesPageEntry params={Promise.resolve({ slug })} />
  const data = await getApplicationPageData(slug)
  if (view === 'workspace')
    redirect(appResourceHref(slug, getRuntimeTools({ permissions: data.permissions })[0]?.id ?? 'overview'))
  const activity =
    data.app && data.isAdmin && firstSearchParamValue(search.view) === 'activity'
      ? await loadApplicationActivity(data.app.id, search)
      : undefined
  return (
    <AppViewerPage
      {...data}
      activity={
        activity && data.app
          ? renderActivity({ ...activity, application: { id: data.app.id, name: data.app.name } })
          : undefined
      }
    />
  )
}

export const ApplicationViewerPageEntry = (props: PageProps) => (
  <Suspense fallback={<AppPageSkeleton activity={props.loadingActivity} />}>
    <ApplicationViewerPageContent {...props} />
  </Suspense>
)
