'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { InfrastructureServiceLayout } from './infrastructure-service-layout'
import { ServiceContainerLinksStatus, useServiceContainerLinks } from './service-container-links-status'
import type { OrchestratorHealth, ServiceContainers } from '@/shared/contracts/diagnostics'

export const OrchestratorServicePage = ({
  initialHealth,
  apiUrl,
  pendingContainers,
  requestId
}: {
  initialHealth: OrchestratorHealth | null
  apiUrl?: string
  pendingContainers?: Promise<ServiceContainers | null>
  requestId?: string
}) => {
  const router = useRouter()
  const containerLinks = useServiceContainerLinks(pendingContainers)
  const [refreshing, startRefresh] = useTransition()
  const health = initialHealth?.services.orchestrator
  const refresh = () => startRefresh(() => router.refresh())
  return (
    <InfrastructureServiceLayout
      serviceId='orchestrator'
      apiUrl={apiUrl}
      container={containerLinks.containers?.orchestrator}
      connectionStatus={
        <ServiceContainerLinksStatus
          {...containerLinks}
          refreshing={refreshing}
          onRetry={refresh}
        />
      }
      actions={
        <PlatformPageRefreshButton
          refreshResult={{ version: initialHealth, succeeded: health?.ok === true }}
          isRefreshing={refreshing}
          onRefresh={refresh}
        />
      }
      health={health}
      healthNotice={{ requestId }}
    />
  )
}
