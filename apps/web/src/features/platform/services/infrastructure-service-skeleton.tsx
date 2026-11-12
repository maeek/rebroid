'use client'

import { DockerMetricsContent } from '@/features/platform/metrics/docker-metrics-dashboard'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { ServiceHealthNotice } from '@/shared/ui/platform/service-health-notice'
import { DockerOperationLimitsSection } from './docker-operation-limits-section'
import { InfrastructureServiceLayout } from './infrastructure-service-layout'

export const InfrastructureServiceSkeleton = ({ serviceId }: { serviceId: 'orchestrator' | 'docker' }) => (
  <InfrastructureServiceLayout
    serviceId={serviceId}
    loading
    actions={
      <PlatformPageRefreshButton
        disabled
        onRefresh={() => undefined}
      />
    }
    health={<ServiceHealthNotice loading />}
    limits={
      serviceId === 'docker' ? (
        <DockerOperationLimitsSection
          loading
          onSaved={() => undefined}
        />
      ) : undefined
    }
    diagnostics={
      serviceId === 'docker' ? (
        <DockerMetricsContent
          data={null}
          history={[]}
          loading
        />
      ) : undefined
    }
  />
)
