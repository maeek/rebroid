import { Suspense } from 'react'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { PlatformInventoryPageSkeleton } from '../../components/loaders/platform-page-skeletons'
import { RuntimeContainersPageClient } from '../../components/runtime-containers-page-client'
import { loadRuntimeContainersPageData, type ContainersSearchParams } from './page-data.server'

const ContainersPageFallback = () => (
  <PlatformInventoryPageSkeleton
    titleWidth='w-48 max-sm:w-32'
    sectionTitleWidth='w-28'
    minWidth='90rem'
    columns={[
      { width: '18rem', headerWidth: 'w-24', kind: 'stacked' },
      { width: '8rem', headerWidth: 'w-16', kind: 'badge' },
      { width: '24rem', headerWidth: 'w-14', kind: 'text', cellWidth: 'w-[84%]' },
      { width: '16rem', headerWidth: 'w-20', kind: 'text', cellWidth: 'w-[68%]' },
      { width: '18rem', headerWidth: 'w-[4.5rem]', kind: 'text', cellWidth: 'w-[74%]' },
      { width: '16rem', headerWidth: 'w-16', kind: 'actions' }
    ]}
  />
)

const RuntimeContainersPageContent = async ({
  searchParams
}: {
  searchParams?: Promise<ContainersSearchParams>
}) => {
  const { containersPage, gridQuery, orchestratorError } = await loadRuntimeContainersPageData(
    (await searchParams) ?? {}
  )

  if (orchestratorError) {
    return (
      <PlatformRouteUnavailable
        title='Containers'
        description='Docker containers visible to the platform. Managed application containers are shown first.'
        detail={orchestratorError}
        href='/runtime/containers'
        breadcrumbRoot={{ label: 'Runtime' }}
      />
    )
  }

  return (
    <RuntimeContainersPageClient
      containersPage={containersPage}
      gridQuery={gridQuery}
    />
  )
}

export function RuntimeContainersPageEntry({
  searchParams
}: {
  searchParams?: Promise<ContainersSearchParams>
}) {
  return (
    <Suspense fallback={<ContainersPageFallback />}>
      <RuntimeContainersPageContent searchParams={searchParams} />
    </Suspense>
  )
}
