'use client'

import { DockerMetricsContent } from '@/features/platform/metrics/docker-metrics-dashboard'
import { DockerOperationLimitsSection } from '@/features/platform/services/docker-operation-limits-section'
import { InfrastructureServiceLayout } from '@/features/platform/services/infrastructure-service-layout'
import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'

export const DockerOverviewLoading = () => (
  <InfrastructureServiceLayout
    serviceId='docker'
    loading
    actions={
      <PlatformPageRefreshButton
        disabled
        onRefresh={() => undefined}
      />
    }
    limits={
      <DockerOperationLimitsSection
        loading
        onSaved={() => undefined}
      />
    }
    diagnostics={
      <DockerMetricsContent
        data={null}
        history={[]}
        loading
      />
    }
  />
)
