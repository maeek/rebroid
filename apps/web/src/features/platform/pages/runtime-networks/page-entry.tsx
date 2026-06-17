import { Suspense } from 'react'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { PlatformInventoryPageSkeleton } from '../../components/loaders/platform-page-skeletons'
import { RuntimeNetworksPageClient } from '../../components/runtime-networks-page-client'
import { loadRuntimeNetworksPageData, type NetworksSearchParams } from './page-data.server'

const NetworksPageFallback = () => (
  <PlatformInventoryPageSkeleton
    titleWidth='w-40 max-sm:w-[7.5rem]'
    minWidth='78rem'
    columns={[
      { width: '22rem', headerWidth: 'w-20', kind: 'stacked' },
      { width: '8rem', headerWidth: 'w-16', kind: 'text', cellWidth: 'w-20' },
      { width: '7rem', headerWidth: 'w-14', kind: 'text', cellWidth: 'w-14' },
      { width: '20rem', headerWidth: 'w-14', kind: 'text', cellWidth: 'w-[76%]' },
      { width: '12rem', headerWidth: 'w-16', kind: 'text', cellWidth: 'w-[72%]' },
      { width: '8rem', headerWidth: 'w-[4.5rem]', kind: 'text', cellWidth: 'w-12' },
      { width: '10rem', headerWidth: 'w-16', kind: 'actions' }
    ]}
  />
)

const RuntimeNetworksPageContent = async ({
  searchParams
}: {
  searchParams?: Promise<NetworksSearchParams>
}) => {
  const { gridQuery, networksPage, orchestratorError } = await loadRuntimeNetworksPageData(
    (await searchParams) ?? {}
  )

  if (orchestratorError) {
    return (
      <PlatformRouteUnavailable
        title='Networks'
        description='Docker networks visible to the platform, including application isolation networks.'
        detail={orchestratorError}
        href='/runtime/networks'
        breadcrumbRoot={{ label: 'Runtime' }}
      />
    )
  }

  return (
    <RuntimeNetworksPageClient
      networksPage={networksPage}
      gridQuery={gridQuery}
    />
  )
}

export function RuntimeNetworksPageEntry({ searchParams }: { searchParams?: Promise<NetworksSearchParams> }) {
  return (
    <Suspense fallback={<NetworksPageFallback />}>
      <RuntimeNetworksPageContent searchParams={searchParams} />
    </Suspense>
  )
}
