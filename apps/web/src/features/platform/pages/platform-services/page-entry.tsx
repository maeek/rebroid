import { Suspense } from 'react'
import { permanentRedirect } from 'next/navigation'
import { InfrastructureServicePage } from '@/features/platform/services/infrastructure-service-page'
import { InfrastructureServiceSkeleton } from '@/features/platform/services/infrastructure-service-skeleton'
import { ServiceSettingsPage } from '@/features/platform/services/service-settings-page'
import { PlatformServicesPage } from '@/features/platform/services/services-page'
import { ServicesInventorySkeleton } from '@/features/platform/services/services-page-skeleton'
import { firstSearchParamValue } from '@/shared/model/search-params'
import { loadPlatformServicesPageData } from './page-data.server'
import type { ServicesSearchParams } from './page-data.server'

const PlatformServicesContent = async ({ searchParams }: { searchParams?: Promise<ServicesSearchParams> }) => {
  const data = await loadPlatformServicesPageData(searchParams)
  if (data.requestedServiceId === 'orchestrator') {
    return (
      <InfrastructureServicePage
        serviceId={data.requestedServiceId}
        initialHealth={data.initialHealth}
        requestId={data.requestId}
        apiUrl={data.initialSettings.orchestratorApiUrl}
        containerId={data.containerIds.orchestrator}
      />
    )
  }
  const serviceId = data.requestedServiceId
  if (serviceId === 'ocr') {
    return (
      <ServiceSettingsPage
        serviceId={serviceId}
        initialHealth={data.initialHealth?.services[serviceId]}
        initialSettings={
          data.initialHealth?.services.orchestrator.ok ? data.initialSettings.services[serviceId] : undefined
        }
        requestId={data.requestId}
        containerId={data.containerIds.ocr}
      />
    )
  }
  return (
    <PlatformServicesPage
      initialHealth={data.initialHealth}
      initialSettings={data.initialSettings}
      requestId={data.requestId}
      containerIds={data.containerIds}
    />
  )
}

export const PlatformServicesPageEntry = async ({ searchParams }: { searchParams?: Promise<ServicesSearchParams> }) => {
  const params = await searchParams
  const service = firstSearchParamValue(params?.service)
  if (service === 'docker') permanentRedirect('/runtime/docker')
  if (service === 'firewall') permanentRedirect('/security/firewall')

  let fallback = <ServicesInventorySkeleton />
  if (service === 'orchestrator') fallback = <InfrastructureServiceSkeleton serviceId={service} />
  if (service === 'ocr') {
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
