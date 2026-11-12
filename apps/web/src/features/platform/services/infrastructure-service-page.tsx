'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DockerMetricsDashboard } from '@/features/platform/metrics/docker-metrics-dashboard'
import { dockerRuntimeHealth } from '@/shared/model/diagnostics/service-health'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { ServiceHealthNotice } from '@/shared/ui/platform/service-health-notice'
import { DockerOperationLimitsSection } from './docker-operation-limits-section'
import { InfrastructureServiceLayout } from './infrastructure-service-layout'
import type { OrchestratorHealth } from '@/shared/contracts/diagnostics'

export const InfrastructureServicePage = ({
  serviceId,
  initialHealth,
  apiUrl,
  requestId
}: {
  serviceId: 'orchestrator' | 'docker'
  initialHealth: OrchestratorHealth | null
  apiUrl: string
  requestId?: string
}) => {
  const router = useRouter()
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, startRefresh] = useTransition()
  const isDocker = serviceId === 'docker'
  const canReadDiagnostics = initialHealth?.services.orchestrator.ok === true
  const dockerHealth = initialHealth && canReadDiagnostics ? dockerRuntimeHealth(initialHealth) : undefined
  const health = isDocker ? dockerHealth : initialHealth?.services.orchestrator
  const refresh = () => {
    startRefresh(() => router.refresh())
    if (canReadDiagnostics) setRefreshKey(value => value + 1)
  }
  return (
    <InfrastructureServiceLayout
      serviceId={serviceId}
      apiUrl={apiUrl}
      actions={
        <PlatformPageRefreshButton
          isRefreshing={refreshing}
          onRefresh={refresh}
        />
      }
      health={
        <ServiceHealthNotice
          health={health}
          requestId={requestId}
          description={
            isDocker && !canReadDiagnostics
              ? 'The orchestrator could not be reached, so Docker health, operation limits, and diagnostics are unavailable. Refresh to check again.'
              : undefined
          }
        />
      }
      limits={isDocker && canReadDiagnostics ? <DockerOperationLimitsSection onSaved={refresh} /> : undefined}
      diagnostics={isDocker && canReadDiagnostics ? <DockerMetricsDashboard refreshKey={refreshKey} /> : undefined}
    />
  )
}
