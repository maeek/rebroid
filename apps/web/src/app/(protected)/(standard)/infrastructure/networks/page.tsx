import { Suspense } from 'react'
import { PlatformInventoryPageSkeleton } from '@/features/orchestrator/components/loaders/orchestrator-page-skeletons'
import { OrchestratorNetworksPageClient } from '@/features/orchestrator/components/orchestrator-networks-page-client'
import { listPlatformNetworksGridAction } from '@/server/orchestrator/platform/network-actions'
import type { PlatformNetworksGridQuery } from '@/server/orchestrator/platform/types'

type NetworksSearchParams = Record<string, string | string[] | undefined>

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

const networksGridQueryFromSearchParams = (searchParams: NetworksSearchParams): PlatformNetworksGridQuery => {
  const scope = firstValue(searchParams.scope)
  return {
    page: Math.max(Number(firstValue(searchParams.page)) || 1, 1),
    pageSize: Math.min(Math.max(Number(firstValue(searchParams.pageSize)) || 20, 1), 100),
    q: firstValue(searchParams.q)?.trim() || undefined,
    scope: scope === 'all' ? 'all' : 'managed',
    sort: firstValue(searchParams.sort)?.trim() || undefined
  }
}

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

const OrchestratorNetworksPageContent = async ({ searchParams }: { searchParams?: Promise<NetworksSearchParams> }) => {
  const gridQuery = networksGridQueryFromSearchParams((await searchParams) ?? {})
  const networksPage = await listPlatformNetworksGridAction(gridQuery)
  return (
    <OrchestratorNetworksPageClient
      networksPage={networksPage}
      gridQuery={gridQuery}
    />
  )
}

export default function OrchestratorNetworksPage({ searchParams }: { searchParams?: Promise<NetworksSearchParams> }) {
  return (
    <Suspense fallback={<NetworksPageFallback />}>
      <OrchestratorNetworksPageContent searchParams={searchParams} />
    </Suspense>
  )
}
