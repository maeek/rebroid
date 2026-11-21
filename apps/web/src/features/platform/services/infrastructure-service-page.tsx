'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DockerMetricsDashboard } from '@/features/platform/metrics/docker-metrics-dashboard'
import { dockerRuntimeHealth } from '@/shared/model/diagnostics/service-health'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { DockerOperationLimitsSection } from './docker-operation-limits-section'
import { InfrastructureServiceLayout } from './infrastructure-service-layout'
import { ServiceContainerLinksStatus, useServiceContainerLinks } from './service-container-links-status'
import type { OrchestratorHealth, ServiceContainers } from '@/shared/contracts/diagnostics'

export const InfrastructureServicePage = ({
  serviceId,
  initialHealth,
  apiUrl,
  pendingContainers,
  requestId
}: {
  serviceId: 'orchestrator' | 'docker'
  initialHealth: OrchestratorHealth | null
  apiUrl?: string
  pendingContainers?: Promise<ServiceContainers | null>
  requestId?: string
}) => {
  const router = useRouter()
  const containerLinks = useServiceContainerLinks(pendingContainers)
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, startRefresh] = useTransition()
  const [metricsRefresh, setMetricsRefresh] = useState({ pending: false, succeeded: true })
  const completeMetricsRefresh = useCallback((succeeded: boolean) => {
    setMetricsRefresh({ pending: false, succeeded })
  }, [])
  const isDocker = serviceId === 'docker'
  const canReadDiagnostics = initialHealth?.services.orchestrator.ok === true
  const dockerHealth = initialHealth && canReadDiagnostics ? dockerRuntimeHealth(initialHealth) : undefined
  const health = isDocker ? dockerHealth : initialHealth?.services.orchestrator
  const refresh = () => {
    startRefresh(() => router.refresh())
    if (isDocker && canReadDiagnostics) {
      setMetricsRefresh({ pending: true, succeeded: false })
      setRefreshKey(value => value + 1)
    }
  }
  return (
    <InfrastructureServiceLayout
      serviceId={serviceId}
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
          refreshResult={{ version: initialHealth, succeeded: canReadDiagnostics && metricsRefresh.succeeded }}
          isRefreshing={refreshing || (canReadDiagnostics && metricsRefresh.pending)}
          onRefresh={refresh}
        />
      }
      health={health}
      healthNotice={{
        requestId,
        description:
          isDocker && !canReadDiagnostics
            ? 'The orchestrator could not be reached, so Docker health, operation limits, and diagnostics are unavailable. Refresh to check again.'
            : undefined
      }}
      limits={isDocker && canReadDiagnostics ? <DockerOperationLimitsSection onSaved={refresh} /> : undefined}
      diagnostics={
        isDocker && canReadDiagnostics ? (
          <DockerMetricsDashboard
            refreshKey={refreshKey}
            onRefreshComplete={completeMetricsRefresh}
          />
        ) : undefined
      }
    />
  )
}
