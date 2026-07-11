import { Suspense } from 'react'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'
import {
  RuntimeContainersPageClient,
  RuntimeContainersPageLoading
} from '../../components/runtime-containers-page-client'
import { loadRuntimeContainersPageData, type ContainersSearchParams } from './page-data.server'

const RuntimeContainersPageContent = async ({ searchParams }: { searchParams?: Promise<ContainersSearchParams> }) => {
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

export function RuntimeContainersPageEntry({ searchParams }: { searchParams?: Promise<ContainersSearchParams> }) {
  return (
    <Suspense fallback={<RuntimeContainersPageLoading />}>
      <RuntimeContainersPageContent searchParams={searchParams} />
    </Suspense>
  )
}
