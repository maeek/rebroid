'use client'

import { DockerMetricsContent } from '@/features/platform/metrics/docker-metrics-dashboard'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
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

export const DockerOverviewLoading = () => <InfrastructureServiceSkeleton serviceId='docker' />
