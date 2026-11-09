import { Suspense, type ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { AppPageFailure } from '@/features/applications/components/app-page-failure'
import { AppViewerPage } from '@/features/applications/detail/app-page'
import { AppPageSkeleton } from '@/features/applications/detail/app-page-skeleton'
import { appResourceHref } from '@/features/applications/detail/app-resource-links'
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
const ApplicationViewerPageContent = async ({ params, searchParams, loadingActivity, renderActivity }: PageProps) => {
  const [{ slug }, search] = await Promise.all([params, searchParams])
  const view = firstSearchParamValue(search.view)
  if (view === 'viewer') redirect(appResourceHref(slug))
  const result = await getApplicationPageData(slug)
  if (result.failure) return <AppPageFailure failure={result.failure} />
  const { data } = result
  if (view === 'workspace')
    redirect(appResourceHref(slug, getRuntimeTools({ permissions: data.permissions })[0]?.id ?? 'overview'))
  return (
    <AppViewerPage
      key={data.app?.id}
      {...data}
      activity={
        data.app && data.isAdmin && view === 'activity' ? (
          <Suspense fallback={loadingActivity}>
            <ApplicationActivity
              application={{ id: data.app.id, name: data.app.name }}
              search={search}
              renderActivity={renderActivity}
            />
          </Suspense>
        ) : undefined
      }
    />
  )
}

const ApplicationActivity = async ({
  application,
  search,
  renderActivity
}: {
  application: { id: string; name: string }
  search: AuditSearchParams
  renderActivity: PageProps['renderActivity']
}) => renderActivity({ ...(await loadApplicationActivity(application.id, search)), application })

export const ApplicationViewerPageEntry = (props: PageProps) => (
  <Suspense fallback={<AppPageSkeleton activity={props.loadingActivity} />}>
    <ApplicationViewerPageContent {...props} />
  </Suspense>
)
