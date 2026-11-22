import { Suspense } from 'react'
import { readOrchestratorPage } from '@/server/orchestrator/orchestrator-page-read'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import {
  RuntimeContainersPageClient,
  RuntimeContainersPageLoading
} from '../../components/runtime-containers-page-client'
import { runtimeInventoryPageHeaders } from '../runtime-inventory-page-headers'
import { loadRuntimeContainersPageData } from './page-data.server'
import type { PlatformGridSearchParams } from '../platform-grid-search'

const RuntimeContainersPageContent = async ({ searchParams }: { searchParams?: Promise<PlatformGridSearchParams> }) => {
  const query = (await searchParams) ?? {}
  const result = await readOrchestratorPage(() => loadRuntimeContainersPageData(query))

  if (!result.ok) {
    return (
      <PlatformRouteUnavailable
        {...runtimeInventoryPageHeaders.containers}
        requestId={result.failure.requestId}
        section={{ label: 'Docker' }}
      />
    )
  }

  return (
    <RuntimeContainersPageClient
      containersPage={result.data.containersPage}
      gridQuery={result.data.gridQuery}
    />
  )
}

export function RuntimeContainersPageEntry({ searchParams }: { searchParams?: Promise<PlatformGridSearchParams> }) {
  return (
    <Suspense fallback={<RuntimeContainersPageLoading />}>
      <RuntimeContainersPageContent searchParams={searchParams} />
    </Suspense>
  )
}
