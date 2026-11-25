import { Suspense } from 'react'
import { permanentRedirect } from 'next/navigation'
import { OrchestratorServicePage } from '@/features/platform/services/infrastructure-service-page'
import { OrchestratorServiceSkeleton } from '@/features/platform/services/infrastructure-service-skeleton'
import { PlatformServicesPage } from '@/features/platform/services/services-page'
import { ServicesInventorySkeleton } from '@/features/platform/services/services-page-skeleton'
import { firstSearchParamValue } from '@/shared/model/search-params'
import { loadPlatformServicesPageData } from './page-data.server'
import type { ServicesSearchParams } from './page-data.server'

const PlatformServicesContent = async ({ searchParams }: { searchParams?: Promise<ServicesSearchParams> }) => {
  const data = await loadPlatformServicesPageData(searchParams)
  if (data.requestedServiceId === 'orchestrator') {
    return (
      <OrchestratorServicePage
        initialHealth={data.initialHealth}
        requestId={data.requestId}
        apiUrl={data.initialSettings.orchestratorApiUrl}
        pendingContainers={data.pendingContainers}
      />
    )
  }
  return (
    <PlatformServicesPage
      initialHealth={data.initialHealth}
      initialSettings={data.initialSettings}
      requestId={data.requestId}
      pendingContainers={data.pendingContainers}
    />
  )
}

export const PlatformServicesPageEntry = async ({ searchParams }: { searchParams?: Promise<ServicesSearchParams> }) => {
  const params = await searchParams
  const service = firstSearchParamValue(params?.service)
  if (service === 'docker') permanentRedirect('/runtime/docker')
  if (service === 'firewall') permanentRedirect('/security/firewall')
  if (service === 'ocr') permanentRedirect('/platform/ocr')

  let fallback = <ServicesInventorySkeleton />
  if (service === 'orchestrator') fallback = <OrchestratorServiceSkeleton />
  return (
    <Suspense
      key={service ?? 'connections'}
      fallback={fallback}
    >
      <PlatformServicesContent searchParams={Promise.resolve(params ?? {})} />
    </Suspense>
  )
}
