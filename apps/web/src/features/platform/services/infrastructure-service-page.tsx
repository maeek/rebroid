'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Notice } from '@/components/ui/notice'
import { DockerMetricsDashboard } from '@/features/platform/metrics/docker-metrics-dashboard'
import { dockerRuntimeHealth } from '@/shared/model/diagnostics/service-health'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { DockerOperationLimitsSection } from './docker-operation-limits-section'
import { InfrastructureServiceLayout } from './infrastructure-service-layout'
import { serviceHealthState } from './service-health-state'
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
  const state = serviceHealthState(health)
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
        <Notice
          tone={state.tone === 'neutral' ? 'info' : state.tone}
          title={state.label}
          description={
            isDocker && !canReadDiagnostics
              ? 'The orchestrator could not be reached, so Docker health, operation limits, and diagnostics are unavailable. Refresh to check again.'
              : state.description
          }
        >
          {requestId ? <p className='text-xs text-foreground-muted'>Reference: {requestId}</p> : null}
        </Notice>
      }
      limits={isDocker && canReadDiagnostics ? <DockerOperationLimitsSection onSaved={refresh} /> : undefined}
      diagnostics={isDocker && canReadDiagnostics ? <DockerMetricsDashboard refreshKey={refreshKey} /> : undefined}
    />
  )
}
