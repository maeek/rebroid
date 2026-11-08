import { Suspense } from 'react'
import { InfrastructureServicePage } from '@/features/platform/services/infrastructure-service-page'
import { InfrastructureServiceSkeleton } from '@/features/platform/services/infrastructure-service-skeleton'
import { PlatformServicesPage } from '@/features/platform/services/services-page'
import { ServicesInventorySkeleton } from '@/features/platform/services/services-page-skeleton'
import { firstSearchParamValue } from '@/shared/model/search-params'
import { loadPlatformServicesPageData } from './page-data.server'
import type { ServicesSearchParams } from './page-data.server'

const PlatformServicesContent = async ({ searchParams }: { searchParams?: Promise<ServicesSearchParams> }) => {
  const data = await loadPlatformServicesPageData(searchParams)
  if (data.requestedServiceId === 'docker' || data.requestedServiceId === 'orchestrator') {
    return (
      <InfrastructureServicePage
        serviceId={data.requestedServiceId}
        initialHealth={data.initialHealth}
        apiUrl={data.initialSettings.orchestratorApiUrl}
      />
    )
  }
  return <PlatformServicesPage {...data} />
}

export const PlatformServicesPageEntry = async ({ searchParams }: { searchParams?: Promise<ServicesSearchParams> }) => {
  const params = await searchParams
  const service = firstSearchParamValue(params?.service)
  const fallback =
    service === 'docker' || service === 'orchestrator' ? (
      <InfrastructureServiceSkeleton serviceId={service} />
    ) : (
      <ServicesInventorySkeleton />
    )
  return (
    <Suspense
      key={service ?? 'connections'}
      fallback={fallback}
    >
      <PlatformServicesContent searchParams={Promise.resolve(params ?? {})} />
    </Suspense>
  )
}
