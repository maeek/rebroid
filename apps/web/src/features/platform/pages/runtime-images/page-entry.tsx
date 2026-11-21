import { Suspense } from 'react'
import { readOrchestratorPage } from '@/server/orchestrator/orchestrator-page-read'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { RuntimeImagesPageClient, RuntimeImagesPageLoading } from '../../components/runtime-images-page-client'
import { loadRuntimeImagesPageData } from './page-data.server'
import type { PlatformGridSearchParams } from '../platform-grid-search'

const RuntimeImagesPageContent = async ({ searchParams }: { searchParams?: Promise<PlatformGridSearchParams> }) => {
  const query = (await searchParams) ?? {}
  const result = await readOrchestratorPage(() => loadRuntimeImagesPageData(query))

  if (!result.ok) {
    return (
      <PlatformRouteUnavailable
        title='Images'
        requestId={result.failure.requestId}
        description='Local images available to application containers, custom runtimes, and platform sidecars.'
        section={{ label: 'Docker' }}
      />
    )
  }

  return (
    <RuntimeImagesPageClient
      imagesPage={result.data.imagesPage}
      gridQuery={result.data.gridQuery}
    />
  )
}

export function RuntimeImagesPageEntry({ searchParams }: { searchParams?: Promise<PlatformGridSearchParams> }) {
  return (
    <Suspense fallback={<RuntimeImagesPageLoading />}>
      <RuntimeImagesPageContent searchParams={searchParams} />
    </Suspense>
  )
}
