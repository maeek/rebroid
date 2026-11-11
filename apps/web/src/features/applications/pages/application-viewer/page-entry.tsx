import { Suspense, type ReactNode } from 'react'
import { AppPageFailure } from '@/features/applications/components/app-page-failure'
import { AppViewerPage } from '@/features/applications/detail/app-page'
import { AppPageSkeleton } from '@/features/applications/detail/app-page-skeleton'
import { getApplicationPageData } from '@/features/applications/pages/shared/application-page-data.server'
import { loadApplicationActivity } from '@/server/audit/application-activity-query'
import { firstSearchParamValue } from '@/shared/model/search-params'
import { loadInspectedContainerCommand } from './page-data.server'
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
  const result = await getApplicationPageData(slug)
  if (result.failure) return <AppPageFailure failure={result.failure} />
  const { data } = result
  const inspectedCommand =
    view === 'diagnostics' && data.isAdmin && data.app.containerId
      ? await loadInspectedContainerCommand(data.app.containerId)
      : undefined
  return (
    <AppViewerPage
      key={data.app?.id}
      {...data}
      inspectedCommand={inspectedCommand}
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
