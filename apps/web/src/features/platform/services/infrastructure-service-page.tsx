'use client'

import { useState } from 'react'
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
  apiUrl
}: {
  serviceId: 'orchestrator' | 'docker'
  initialHealth: OrchestratorHealth | null
  apiUrl: string
}) => {
  const router = useRouter()
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const isDocker = serviceId === 'docker'
  const health = isDocker && initialHealth ? dockerRuntimeHealth(initialHealth) : initialHealth?.services.orchestrator
  const state = serviceHealthState(health)
  const refresh = () => {
    router.refresh()
    setRefreshKey(value => value + 1)
    setRefreshing(isDocker)
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
          description={state.description}
        />
      }
      limits={isDocker ? <DockerOperationLimitsSection onSaved={refresh} /> : undefined}
      diagnostics={
        isDocker ? (
          <DockerMetricsDashboard
            refreshKey={refreshKey}
            onRefreshComplete={() => setRefreshing(false)}
          />
        ) : undefined
      }
    />
  )
}
