import { Suspense } from 'react'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import { RuntimeNetworksPageClient, RuntimeNetworksPageLoading } from '../../components/runtime-networks-page-client'
import { loadRuntimeNetworksPageData, type NetworksSearchParams } from './page-data.server'

const RuntimeNetworksPageContent = async ({ searchParams }: { searchParams?: Promise<NetworksSearchParams> }) => {
  const { gridQuery, networksPage, orchestratorError } = await loadRuntimeNetworksPageData((await searchParams) ?? {})

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
    <Suspense fallback={<RuntimeNetworksPageLoading />}>
      <RuntimeNetworksPageContent searchParams={searchParams} />
    </Suspense>
  )
}
