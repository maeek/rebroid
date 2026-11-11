import { Suspense } from 'react'
import { InfrastructureServicePage } from '@/features/platform/services/infrastructure-service-page'
import { InfrastructureServiceSkeleton } from '@/features/platform/services/infrastructure-service-skeleton'
import { isConfigurableService } from '@/features/platform/services/service-definitions'
import { ServiceSettingsPage } from '@/features/platform/services/service-settings-page'
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
        requestId={data.requestId}
        apiUrl={data.initialSettings.orchestratorApiUrl}
      />
    )
  }
  const serviceId = data.requestedServiceId
  if (isConfigurableService(serviceId)) {
    return (
      <ServiceSettingsPage
        serviceId={serviceId}
        initialHealth={data.initialHealth?.services[serviceId]}
        initialSettings={
          data.initialHealth?.services.orchestrator.ok ? data.initialSettings.services[serviceId] : undefined
        }
        requestId={data.requestId}
      />
    )
  }
  return (
    <PlatformServicesPage
      initialHealth={data.initialHealth}
      initialSettings={data.initialSettings}
      requestId={data.requestId}
    />
  )
}

export const PlatformServicesPageEntry = async ({ searchParams }: { searchParams?: Promise<ServicesSearchParams> }) => {
  const params = await searchParams
  const service = firstSearchParamValue(params?.service)
  let fallback = <ServicesInventorySkeleton />
  if (service === 'docker' || service === 'orchestrator')
    fallback = <InfrastructureServiceSkeleton serviceId={service} />
  if (isConfigurableService(service)) {
    fallback = (
      <ServiceSettingsPage
        serviceId={service}
        loading
      />
    )
  }
  return (
    <Suspense
      key={service ?? 'connections'}
      fallback={fallback}
    >
      <PlatformServicesContent searchParams={Promise.resolve(params ?? {})} />
    </Suspense>
  )
}
