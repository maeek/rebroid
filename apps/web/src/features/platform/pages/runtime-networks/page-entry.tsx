import { Suspense } from 'react'
import { readOrchestratorPage } from '@/server/orchestrator/orchestrator-page-read'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { RuntimeNetworksPageClient, RuntimeNetworksPageLoading } from '../../components/runtime-networks-page-client'
import { runtimeInventoryPageHeaders } from '../runtime-inventory-page-headers'
import { loadRuntimeNetworksPageData } from './page-data.server'
import type { PlatformGridSearchParams } from '../platform-grid-search'

const RuntimeNetworksPageContent = async ({ searchParams }: { searchParams?: Promise<PlatformGridSearchParams> }) => {
  const query = (await searchParams) ?? {}
  const result = await readOrchestratorPage(() => loadRuntimeNetworksPageData(query))

  if (!result.ok) {
    return (
      <PlatformRouteUnavailable
        {...runtimeInventoryPageHeaders.networks}
        requestId={result.failure.requestId}
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

export function RuntimeNetworksPageEntry({ searchParams }: { searchParams?: Promise<PlatformGridSearchParams> }) {
  return (
    <Suspense fallback={<RuntimeNetworksPageLoading />}>
      <RuntimeNetworksPageContent searchParams={searchParams} />
    </Suspense>
  )
}
