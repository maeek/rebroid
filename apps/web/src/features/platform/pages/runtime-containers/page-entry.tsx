import { Suspense } from 'react'
import { readOrchestratorPage } from '@/server/orchestrator/orchestrator-page-read'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import {
  RuntimeContainersPageClient,
  RuntimeContainersPageLoading
} from '../../components/runtime-containers-page-client'
import { loadRuntimeContainersPageData, type ContainersSearchParams } from './page-data.server'

const RuntimeContainersPageContent = async ({ searchParams }: { searchParams?: Promise<ContainersSearchParams> }) => {
  const query = (await searchParams) ?? {}
  const result = await readOrchestratorPage(() => loadRuntimeContainersPageData(query))

  if (!result.ok) {
    return (
      <PlatformRouteUnavailable
        title='Containers'
        requestId={result.failure.requestId}
        description='Docker containers visible to the platform. Managed application containers are shown first.'
        section={{ label: 'Runtime' }}
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

export function RuntimeContainersPageEntry({ searchParams }: { searchParams?: Promise<ContainersSearchParams> }) {
  return (
    <Suspense fallback={<RuntimeContainersPageLoading />}>
      <RuntimeContainersPageContent searchParams={searchParams} />
    </Suspense>
  )
}
