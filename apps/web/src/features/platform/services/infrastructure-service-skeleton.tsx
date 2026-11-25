'use client'

import { PlatformPageRefreshButton } from '@/shared/ui/actions/platform-page-refresh-button'
import { InfrastructureServiceLayout } from './infrastructure-service-layout'

export const OrchestratorServiceSkeleton = () => (
  <InfrastructureServiceLayout
    serviceId='orchestrator'
    loading
    actions={
      <PlatformPageRefreshButton
        disabled
        onRefresh={() => undefined}
      />
    }
  />
)
