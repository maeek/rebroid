import { Suspense } from 'react'
import { readOrchestratorPage } from '@/server/orchestrator/orchestrator-page-read'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { RuntimeNetworksPageClient, RuntimeNetworksPageLoading } from '../../components/runtime-networks-page-client'
import { loadRuntimeNetworksPageData, type NetworksSearchParams } from './page-data.server'

const RuntimeNetworksPageContent = async ({ searchParams }: { searchParams?: Promise<NetworksSearchParams> }) => {
  const query = (await searchParams) ?? {}
  const result = await readOrchestratorPage(() => loadRuntimeNetworksPageData(query))

  if (!result.ok) {
    return (
      <PlatformRouteUnavailable
        title='Networks'
        requestId={result.failure.requestId}
        description='Docker networks visible to the platform, including application isolation networks.'
        section={{ label: 'Docker' }}
      />
    )
  }

  return (
    <RuntimeNetworksPageClient
      networksPage={result.data.networksPage}
      gridQuery={result.data.gridQuery}
    />
  )
}

export function RuntimeNetworksPageEntry({ searchParams }: { searchParams?: Promise<NetworksSearchParams> }) {
  return (
    <Suspense fallback={<RuntimeNetworksPageLoading />}>
      <RuntimeNetworksPageContent searchParams={searchParams} />
    </Suspense>
  )
}
