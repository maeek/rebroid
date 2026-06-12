import { Suspense } from 'react'
import { PlatformInventoryPageSkeleton } from '../../components/loaders/orchestrator-page-skeletons'
import { OrchestratorNetworksPageClient } from '../../components/orchestrator-networks-page-client'
import { loadInfrastructureNetworksPageData, type NetworksSearchParams } from './page-data.server'

const NetworksPageFallback = () => (
  <PlatformInventoryPageSkeleton
    titleWidth='w-40 max-sm:w-[7.5rem]'
    sectionTitleWidth='w-24'
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

const InfrastructureNetworksPageContent = async ({
  searchParams
}: {
  searchParams?: Promise<NetworksSearchParams>
}) => {
  const { gridQuery, networksPage } = await loadInfrastructureNetworksPageData((await searchParams) ?? {})
  return (
    <OrchestratorNetworksPageClient
      networksPage={networksPage}
      gridQuery={gridQuery}
    />
  )
}

export function InfrastructureNetworksPageEntry({ searchParams }: { searchParams?: Promise<NetworksSearchParams> }) {
  return (
    <Suspense fallback={<NetworksPageFallback />}>
      <InfrastructureNetworksPageContent searchParams={searchParams} />
    </Suspense>
  )
}
