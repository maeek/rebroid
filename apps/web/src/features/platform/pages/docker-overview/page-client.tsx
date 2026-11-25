'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DockerMetricsDashboard } from '@/features/platform/metrics/docker-metrics-dashboard'
import { DockerOperationLimitsSection } from '@/features/platform/services/docker-operation-limits-section'
import { InfrastructureServiceLayout } from '@/features/platform/services/infrastructure-service-layout'
import { dockerRuntimeHealth } from '@/shared/model/diagnostics/service-health'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import type { OrchestratorHealth } from '@/shared/contracts/diagnostics'

export const DockerOverviewPageClient = ({
  initialHealth,
  requestId
}: {
  initialHealth: OrchestratorHealth | null
  requestId?: string
}) => {
  const router = useRouter()
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, startRefresh] = useTransition()
  const [metricsRefresh, setMetricsRefresh] = useState({ pending: false, succeeded: true })
  const completeMetricsRefresh = useCallback((succeeded: boolean) => {
    setMetricsRefresh({ pending: false, succeeded })
  }, [])
  const canReadDiagnostics = initialHealth?.services.orchestrator.ok === true
  const refresh = () => {
    startRefresh(() => router.refresh())
    if (canReadDiagnostics) {
      setMetricsRefresh({ pending: true, succeeded: false })
      setRefreshKey(value => value + 1)
    }
  }
  return (
    <InfrastructureServiceLayout
      serviceId='docker'
      actions={
        <PlatformPageRefreshButton
          refreshResult={{ version: initialHealth, succeeded: canReadDiagnostics && metricsRefresh.succeeded }}
          isRefreshing={refreshing || (canReadDiagnostics && metricsRefresh.pending)}
          onRefresh={refresh}
        />
      }
      health={canReadDiagnostics ? dockerRuntimeHealth(initialHealth) : undefined}
      healthNotice={{
        requestId,
        description: canReadDiagnostics
          ? undefined
          : 'The orchestrator could not be reached, so Docker health, operation limits, and diagnostics are unavailable. Refresh to check again.'
      }}
      limits={canReadDiagnostics ? <DockerOperationLimitsSection onSaved={refresh} /> : undefined}
      diagnostics={
        canReadDiagnostics ? (
          <DockerMetricsDashboard
            refreshKey={refreshKey}
            onRefreshComplete={completeMetricsRefresh}
          />
        ) : undefined
      }
    />
  )
}
